import { NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import {
  baseExplorerTx,
  KUDI_DEFAULT_CHAIN_ID,
  KUDI_QUOTE_FROM_TOKEN,
} from "@/lib/lifi/constants";
import { sendComposerTransaction } from "@/lib/lifi/execute-deposit";
import { fetchEarnVaultApySnapshot } from "@/lib/lifi/earn-vault-snapshot";
import { fetchComposerQuote } from "@/lib/lifi/server";
import { getCustodialSigner } from "@/lib/custodial-signer";
import { userFacingTransactionError } from "@/lib/chain-errors";
import { ensureUserWallet } from "@/lib/wallet-provision";
import { recordWalletActivity } from "@/lib/wallet-activity";
import { WalletActivityType } from "@/generated/prisma/enums";

const bodySchema = z.object({
  vaultAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  /** USDC base units on Base (6 decimals), e.g. "1000000" = 1 dollar. */
  fromAmount: z.string().regex(/^[1-9][0-9]*$/),
  /** Optional display name for activity history (pool title). */
  vaultLabel: z.string().max(240).optional(),
  /** Earn / markets protocol id (e.g. yo-protocol) for portfolio when Li.fi mislabels the pool. */
  protocolName: z.string().max(120).optional(),
  /** Earn vault slug from markets API. */
  vaultSlug: z.string().max(240).optional(),
  /** Fallback APY % (total) if Earn API does not return this vault in the snapshot query. */
  apyTotalAtDeposit: z.number().finite().optional(),
});

/**
 * Fetches a Composer quote into the given vault and submits approval + tx
 * from the user's custodial wallet (Base + USDC → vault).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { vaultAddress, fromAmount, vaultLabel, protocolName, vaultSlug, apyTotalAtDeposit: clientApy } =
    parsed.data;
  const chainId = KUDI_DEFAULT_CHAIN_ID;

  try {
    const { address } = await ensureUserWallet(user.id);
    const chain = String(chainId);

    const quoteParams: Record<string, string> = {
      fromChain: chain,
      toChain: chain,
      fromToken: KUDI_QUOTE_FROM_TOKEN,
      toToken: vaultAddress,
      fromAddress: address,
      toAddress: address,
      fromAmount,
    };

    const quote = await fetchComposerQuote(quoteParams);
    const signer = await getCustodialSigner(user.id, chainId);
    const { hash } = await sendComposerTransaction(signer, quote);

    const apySnapshotAt = new Date().toISOString();
    const earnSnap = await fetchEarnVaultApySnapshot(vaultAddress);

    const apyMeta: Prisma.InputJsonObject = earnSnap
      ? {
          apyTotalAtDeposit: earnSnap.apyTotal,
          apyBaseAtDeposit: earnSnap.apyBase ?? null,
          apyRewardAtDeposit: earnSnap.apyReward ?? null,
          apySnapshotSource: "earn_api",
        }
      : clientApy != null && Number.isFinite(clientApy)
        ? {
            apyTotalAtDeposit: clientApy,
            apyBaseAtDeposit: null,
            apyRewardAtDeposit: null,
            apySnapshotSource: "client",
          }
        : {
            apyTotalAtDeposit: null,
            apyBaseAtDeposit: null,
            apyRewardAtDeposit: null,
            apySnapshotSource: "unknown",
          };

    const meta: Prisma.InputJsonValue = {
      vaultAddress,
      vaultLabel: vaultLabel ?? null,
      protocolName: protocolName ?? null,
      vaultSlug: vaultSlug ?? null,
      chainId,
      apySnapshotAt,
      ...apyMeta,
    };

    await recordWalletActivity({
      userId: user.id,
      type: WalletActivityType.VAULT_INVEST,
      amountUsdcBaseUnits: fromAmount,
      txHash: hash,
      explorerUrl: baseExplorerTx(hash),
      meta,
    });

    return NextResponse.json({
      ok: true,
      txHash: hash,
      explorerUrl: baseExplorerTx(hash),
      chainId,
    });
  } catch (err) {
    console.error("[api/lifi/deposit]", err);
    const raw = err instanceof Error ? err.message : "Deposit failed";
    const { message, httpStatus } = userFacingTransactionError(raw);
    return NextResponse.json(
      { error: message, code: "LIFI_DEPOSIT_FAILED" },
      { status: httpStatus },
    );
  }
}
