import { NextResponse } from "next/server";
import { JsonRpcProvider } from "ethers";

import { getSessionUser } from "@/lib/auth/session";
import { ensureUserWallet } from "@/lib/wallet-provision";
import { KUDI_CHAIN } from "@/lib/kudi-chain";
import { KUDI_QUOTE_FROM_TOKEN } from "@/lib/lifi/constants";

const BASE_RPC = process.env.BASE_RPC_URL?.trim() || "https://mainnet.base.org";

// USDC on Base has 6 decimals
const USDC_DECIMALS = 6;

/**
 * Returns the authenticated user's USDC balance on Base.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const wallet = await ensureUserWallet(user.id);
    const provider = new JsonRpcProvider(BASE_RPC);

    // ERC-20 balanceOf(address) selector
    const data = `0x70a08231000000000000000000000000${wallet.address.slice(2).toLowerCase()}`;

    const result = await provider.call({
      to: KUDI_QUOTE_FROM_TOKEN,
      data,
    });

    // Parse hex balance
    const balanceWei = BigInt(result);
    const balanceUsdc = Number(balanceWei) / Math.pow(10, USDC_DECIMALS);

    return NextResponse.json({
      address: wallet.address,
      token: "USDC",
      balance: balanceUsdc,
      /** Exact on-chain balance in USDC base units (6 decimals), for Max / precise forms */
      balanceBaseUnits: balanceWei.toString(),
      chainId: KUDI_CHAIN.chainId,
      chainName: KUDI_CHAIN.name,
    });
  } catch (err) {
    console.error("[api/wallet/balance]", err);
    const message = err instanceof Error ? err.message : "Could not fetch balance.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
