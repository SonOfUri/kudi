import { NextResponse } from "next/server";
import { Contract } from "ethers";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { WalletActivityType } from "@/generated/prisma/enums";
import { getCustodialSigner } from "@/lib/custodial-signer";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { KUDI_CHAIN } from "@/lib/kudi-chain";
import {
  createPaycrestOfframpOrder,
  estimateNgnFromSell,
  fetchPaycrestRate,
  extractSellQuote,
  MIN_OFFRAMP_USDC,
  normalizeOfframpCreateResponse,
  offrampTotalUsdcBaseUnits,
} from "@/lib/paycrest/client";
import { isPaycrestOnrampConfigured } from "@/lib/paycrest/config";
import { baseExplorerTx, KUDI_QUOTE_FROM_TOKEN } from "@/lib/lifi/constants";
import { userFacingTransactionError } from "@/lib/chain-errors";
import { ensureUserWallet } from "@/lib/wallet-provision";
import { recordWalletActivity } from "@/lib/wallet-activity";

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

const recipientSchema = z.object({
  institution: z.string().trim().min(1).max(200),
  accountIdentifier: z.string().trim().min(1).max(80),
  accountName: z.string().trim().min(1).max(200),
  memo: z.string().trim().max(200).optional(),
});

const bodySchema = z.object({
  amount: z.string().trim().regex(/^[\d.]+$/),
  rate: z.string().trim().min(1).max(80).optional(),
  recipient: recipientSchema,
});

function referenceForUser(userId: string) {
  return `kudi-offramp-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function usdcAmountOk(s: string): { ok: true; n: number } | { ok: false } {
  const n = Number.parseFloat(s.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < MIN_OFFRAMP_USDC) return { ok: false };
  return { ok: true, n };
}

/**
 * Create Paycrest off-ramp order, send USDC from custodial wallet to Paycrest deposit address.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPaycrestOnrampConfigured()) {
    return NextResponse.json(
      { error: "Bank transfers are not available right now.", code: "FIAT_TRANSFER_DISABLED" },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const amountCheck = usdcAmountOk(parsed.data.amount);
  if (!amountCheck.ok) {
    return NextResponse.json(
      { error: `Minimum cash-out is ${MIN_OFFRAMP_USDC} USDC.` },
      { status: 400 },
    );
  }

  let verifiedRate: string | null = parsed.data.rate?.trim() ?? null;
  let ngnEstimateForDb: string | null = null;
  try {
    const rateJson = await fetchPaycrestRate(parsed.data.amount, "NGN");
    const { rate: liveSell, ngnReceive: ngnFromApi } = extractSellQuote(rateJson);
    if (!liveSell?.trim()) {
      return NextResponse.json(
        { error: "Could not verify rate for this amount." },
        { status: 502 },
      );
    }
    const liveTrim = liveSell.trim();
    if (verifiedRate && verifiedRate !== liveTrim) {
      return NextResponse.json(
        { error: "Rate changed. Refresh the quote and try again.", code: "RATE_STALE" },
        { status: 409 },
      );
    }
    verifiedRate = liveTrim;
    ngnEstimateForDb =
      ngnFromApi?.trim() ||
      estimateNgnFromSell(amountCheck.n, liveTrim) ||
      null;
  } catch (e) {
    console.error("[api/paycrest/offramp] rate verify", e);
    return NextResponse.json({ error: "Could not verify rate." }, { status: 502 });
  }

  const chainId = KUDI_CHAIN.chainId;
  const reference = referenceForUser(user.id);

  try {
    const { address: fromAddress } = await ensureUserWallet(user.id);
    const raw = await createPaycrestOfframpOrder({
      amount: parsed.data.amount,
      rate: verifiedRate ?? undefined,
      refundAddress: fromAddress,
      recipient: parsed.data.recipient,
      reference,
    });

    const normalized = normalizeOfframpCreateResponse(raw, parsed.data.amount);
    if (!normalized?.receiverAddress) {
      console.error("[api/paycrest/offramp] Missing deposit address:", raw);
      return NextResponse.json(
        { error: "Unexpected response from payment partner." },
        { status: 502 },
      );
    }

    const totalBaseUnits = offrampTotalUsdcBaseUnits(normalized, parsed.data.amount);
    const signer = await getCustodialSigner(user.id, chainId);
    const usdc = new Contract(KUDI_QUOTE_FROM_TOKEN, ERC20_ABI, signer);
    const bal: bigint = await usdc.balanceOf(fromAddress);
    if (bal < totalBaseUnits) {
      return NextResponse.json(
        {
          error:
            "Insufficient USDC for this cash-out (including partner fee). Add funds or use a smaller amount.",
          code: "INSUFFICIENT_BALANCE",
        },
        { status: 400 },
      );
    }

    const tx = await usdc.transfer(normalized.receiverAddress, totalBaseUnits);
    await tx.wait();

    await db.paycrestOfframpOrder.create({
      data: {
        userId: user.id,
        paycrestOrderId: normalized.paycrestOrderId,
        reference,
        status: normalized.status ?? "PENDING",
        amountUsdc: parsed.data.amount,
        fiatCurrency: "NGN",
        rate: verifiedRate ?? null,
        ngnEstimate: ngnEstimateForDb,
        providerAccount: normalized.providerAccountJson
          ? (normalized.providerAccountJson as Prisma.InputJsonValue)
          : undefined,
        depositTxHash: tx.hash,
      },
    });

    const meta: Prisma.InputJsonValue = {
      paycrestOrderId: normalized.paycrestOrderId,
      reference,
      amountUsdc: parsed.data.amount,
      fiatCurrency: "NGN",
    };

    await recordWalletActivity({
      userId: user.id,
      type: WalletActivityType.PAYCREST_OFFRAMP,
      amountUsdcBaseUnits: totalBaseUnits.toString(),
      txHash: tx.hash,
      explorerUrl: baseExplorerTx(tx.hash),
      meta,
    });

    return NextResponse.json({
      ok: true,
      orderId: normalized.paycrestOrderId,
      reference,
      txHash: tx.hash,
      explorerUrl: baseExplorerTx(tx.hash),
      validUntil: normalized.validUntil,
    });
  } catch (err) {
    console.error("[api/paycrest/offramp]", err);
    const raw = err instanceof Error ? err.message : "Off-ramp failed";
    const { message, httpStatus } = userFacingTransactionError(raw);
    return NextResponse.json(
      { error: message, code: "CASHOUT_FAILED" },
      { status: httpStatus },
    );
  }
}
