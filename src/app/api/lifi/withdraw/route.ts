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
import { fetchComposerQuote } from "@/lib/lifi/server";
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
});

function quoteToUsdcBaseUnits(quote: {
  action?: { toToken?: { decimals?: number }; toAmount?: string };
}): string | null {
  const decimals = quote.action?.toToken?.decimals;
  const amt = quote.action?.toAmount;
  if (typeof decimals !== "number" || !Number.isFinite(decimals) || decimals < 0 || decimals > 36) {
    return null;
  }
  if (typeof amt !== "string" || !/^[0-9]+$/.test(amt)) {
    return null;
  }
  if (decimals === 6) return amt;
  try {
    const asDecimal = formatUnits(BigInt(amt), decimals);
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

  const { vaultAddress, fromAmount, vaultLabel } = parsed.data;
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

    const amountUsdcBaseUnits = quoteToUsdcBaseUnits(quote);

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
