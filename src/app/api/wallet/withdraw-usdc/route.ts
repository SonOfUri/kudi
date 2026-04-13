import { NextResponse } from "next/server";
import { Contract, isAddress } from "ethers";
import { z } from "zod";

import { getCustodialSigner } from "@/lib/custodial-signer";
import { getSessionUser } from "@/lib/auth/session";
import { KUDI_CHAIN } from "@/lib/kudi-chain";
import { baseExplorerTx, KUDI_QUOTE_FROM_TOKEN } from "@/lib/lifi/constants";
import { userFacingTransactionError } from "@/lib/chain-errors";
import { ensureUserWallet } from "@/lib/wallet-provision";
import { recordWalletActivity } from "@/lib/wallet-activity";
import { WalletActivityType } from "@/generated/prisma/enums";

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

const bodySchema = z.object({
  toAddress: z.string(),
  /** Whole USDC base units (6 decimals), e.g. "1000000" = 1 USDC, or "max" for full balance. */
  amount: z.union([z.literal("max"), z.string().regex(/^[1-9][0-9]*$/)]),
});

/**
 * Sends USDC from the user's custodial wallet on Base to another address.
 * Requires a small amount of ETH on Base in the same wallet for gas.
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

  const { toAddress, amount } = parsed.data;
  if (!isAddress(toAddress)) {
    return NextResponse.json({ error: "Invalid destination address" }, { status: 400 });
  }

  const chainId = KUDI_CHAIN.chainId;

  try {
    const { address: fromAddress } = await ensureUserWallet(user.id);
    if (toAddress.toLowerCase() === fromAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Destination must be different from your Kudi wallet." },
        { status: 400 },
      );
    }

    const signer = await getCustodialSigner(user.id, chainId);
    const usdc = new Contract(KUDI_QUOTE_FROM_TOKEN, ERC20_ABI, signer);

    let value: bigint;
    if (amount === "max") {
      value = await usdc.balanceOf(fromAddress);
      if (value <= BigInt(0)) {
        return NextResponse.json({ error: "No USDC balance to send." }, { status: 400 });
      }
    } else {
      value = BigInt(amount);
      const bal: bigint = await usdc.balanceOf(fromAddress);
      if (bal < value) {
        return NextResponse.json({ error: "Amount exceeds your USDC balance." }, { status: 400 });
      }
    }

    const tx = await usdc.transfer(toAddress, value);
    await tx.wait();

    await recordWalletActivity({
      userId: user.id,
      type: WalletActivityType.USDC_WITHDRAW,
      amountUsdcBaseUnits: value.toString(),
      txHash: tx.hash,
      explorerUrl: baseExplorerTx(tx.hash),
      meta: { toAddress },
    });

    return NextResponse.json({
      ok: true,
      txHash: tx.hash,
      explorerUrl: baseExplorerTx(tx.hash),
      chainId,
      amountBaseUnits: value.toString(),
    });
  } catch (err) {
    console.error("[api/wallet/withdraw-usdc]", err);
    const raw = err instanceof Error ? err.message : "Withdrawal failed";
    const { message, httpStatus } = userFacingTransactionError(raw);
    return NextResponse.json({ error: message, code: "USDC_WITHDRAW_FAILED" }, { status: httpStatus });
  }
}
