import { formatUnits, parseUnits } from "ethers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import {
  baseExplorerTx,
  KUDI_DEFAULT_CHAIN_ID,
  KUDI_QUOTE_FROM_TOKEN,
} from "@/lib/lifi/constants";
import { sendComposerTransaction } from "@/lib/lifi/execute-deposit";
import { fetchComposerQuote, type LiFiQuoteResponse } from "@/lib/lifi/server";
import { getCustodialSigner } from "@/lib/custodial-signer";
import { userFacingTransactionError } from "@/lib/chain-errors";
import { ensureUserWallet } from "@/lib/wallet-provision";
import { recordWalletActivity } from "@/lib/wallet-activity";
import { WalletActivityType } from "@/generated/prisma/enums";

const bodySchema = z.object({
  vaultAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  /** Vault share amount in smallest units (integer string). */
  fromAmount: z.string().regex(/^[1-9][0-9]*$/),
  vaultLabel: z.string().max(240).optional(),
  /**
   * Optional USDC base units (6 dp) from the client’s USD estimate when the Li.Fi quote omits
   * a parseable `toAmount` (used only if the quote parser returns null).
   */
  fallbackReceiveUsdcBaseUnits: z.string().regex(/^[1-9][0-9]*$/).optional(),
});

function uintString(v: unknown): string | null {
  if (typeof v !== "string" || !/^[0-9]+$/.test(v)) return null;
  return v;
}

/**
 * USDC-out from Composer quote: tries `action.toAmount`, then `estimate.toAmount` / `toAmountMin`.
 * Vault exits are quoted to Base USDC; we default output decimals to 6 when Li.Fi omits `toToken.decimals`.
 */
function quoteOutputToUsdcBaseUnits(quote: LiFiQuoteResponse): string | null {
  const usdcAddr = KUDI_QUOTE_FROM_TOKEN.toLowerCase();
  const actionTo = quote.action?.toToken;
  const estTo =
    quote.estimate && typeof quote.estimate === "object"
      ? (quote.estimate as { toToken?: { decimals?: number; address?: string } }).toToken
      : undefined;

  let outDecimals: number | null = null;
  if (typeof actionTo?.decimals === "number" && Number.isFinite(actionTo.decimals)) {
    outDecimals = actionTo.decimals;
  } else if (typeof estTo?.decimals === "number" && Number.isFinite(estTo.decimals)) {
    outDecimals = estTo.decimals;
  } else {
    const addr =
      (typeof actionTo?.address === "string" && actionTo.address.toLowerCase()) ||
      (typeof estTo?.address === "string" && estTo.address.toLowerCase()) ||
      "";
    if (addr === usdcAddr) outDecimals = 6;
  }
  if (outDecimals == null) {
    outDecimals = 6;
  }
  if (outDecimals < 0 || outDecimals > 36) return null;

  const raw =
    uintString(quote.action?.toAmount) ??
    uintString(quote.estimate?.toAmount) ??
    uintString(quote.estimate?.toAmountMin);
  if (!raw) return null;

  if (outDecimals === 6) return raw;
  try {
    const asDecimal = formatUnits(BigInt(raw), outDecimals);
    return parseUnits(asDecimal, 6).toString();
  } catch {
    return null;
  }
}

/**
 * Composer quote from vault shares → USDC (same chain, custodial wallet).
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

  const { vaultAddress, fromAmount, vaultLabel, fallbackReceiveUsdcBaseUnits } = parsed.data;
  const chainId = KUDI_DEFAULT_CHAIN_ID;
  const chain = String(chainId);

  try {
    const { address } = await ensureUserWallet(user.id);

    const quoteParams: Record<string, string> = {
      fromChain: chain,
      toChain: chain,
      fromToken: vaultAddress,
      toToken: KUDI_QUOTE_FROM_TOKEN,
      fromAddress: address,
      toAddress: address,
      fromAmount,
    };

    const quote = await fetchComposerQuote(quoteParams);
    const signer = await getCustodialSigner(user.id, chainId);
    const { hash } = await sendComposerTransaction(signer, quote);

    const amountUsdcBaseUnits =
      quoteOutputToUsdcBaseUnits(quote) ?? fallbackReceiveUsdcBaseUnits ?? null;

    await recordWalletActivity({
      userId: user.id,
      type: WalletActivityType.VAULT_WITHDRAW,
      amountUsdcBaseUnits,
      txHash: hash,
      explorerUrl: baseExplorerTx(hash),
      meta: {
        vaultAddress,
        vaultLabel: vaultLabel ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      txHash: hash,
      explorerUrl: baseExplorerTx(hash),
      chainId,
      /** USDC received (6 decimals), from the quote or client fallback — for success UI and activity parity. */
      ...(amountUsdcBaseUnits ? { amountUsdcBaseUnits } : {}),
    });
  } catch (err) {
    console.error("[api/lifi/withdraw]", err);
    const raw = err instanceof Error ? err.message : "Withdraw failed";
    const { message, httpStatus } = userFacingTransactionError(raw);
    return NextResponse.json(
      { error: message, code: "LIFI_WITHDRAW_FAILED" },
      { status: httpStatus },
    );
  }
}
