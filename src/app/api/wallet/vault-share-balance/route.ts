import { Contract, JsonRpcProvider } from "ethers";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { KUDI_DEFAULT_CHAIN_ID } from "@/lib/lifi/constants";
import { rpcUrlForChain } from "@/lib/custodial-signer";
import { ensureUserWallet } from "@/lib/wallet-provision";

const BALANCE_ABI = ["function balanceOf(address owner) view returns (uint256)"] as const;

/**
 * On-chain vault (share) token balance for the custodial wallet.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vaultAddress = new URL(req.url).searchParams.get("vaultAddress")?.trim() ?? "";
  if (!/^0x[a-fA-F0-9]{40}$/i.test(vaultAddress)) {
    return NextResponse.json({ error: "Invalid vaultAddress" }, { status: 400 });
  }

  try {
    const { address } = await ensureUserWallet(user.id);
    const provider = new JsonRpcProvider(rpcUrlForChain(KUDI_DEFAULT_CHAIN_ID), KUDI_DEFAULT_CHAIN_ID);
    const c = new Contract(vaultAddress, BALANCE_ABI, provider);
    const bal = await c.balanceOf(address);
    return NextResponse.json({ balance: bal.toString() });
  } catch (err) {
    console.error("[api/wallet/vault-share-balance]", err);
    const message = err instanceof Error ? err.message : "Could not read balance.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
