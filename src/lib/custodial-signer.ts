import { JsonRpcProvider, Wallet } from "ethers";

import { db } from "@/lib/db";
import { KUDI_CHAIN } from "@/lib/kudi-chain";

const MIN_SECRET_LEN = 16;

const DEFAULT_BASE_RPC = "https://mainnet.base.org";

export function rpcUrlForChain(chainId: number): string {
  if (chainId === KUDI_CHAIN.chainId) {
    return process.env.BASE_RPC_URL?.trim() || DEFAULT_BASE_RPC;
  }
  throw new Error(
    `Kudi is live on ${KUDI_CHAIN.name} only (${KUDI_CHAIN.chainId}). No RPC for chain ${chainId}.`,
  );
}

/**
 * Connects the user's custodial keystore to a JSON-RPC provider for the given chain.
 */
export async function getCustodialSigner(userId: string, chainId: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < MIN_SECRET_LEN) {
    throw new Error(`AUTH_SECRET must be set and at least ${MIN_SECRET_LEN} characters.`);
  }

  const row = await db.wallet.findUnique({
    where: { userId },
    select: { encryptedPrivateKey: true },
  });
  if (!row) {
    throw new Error("No wallet on file for this user.");
  }

  const wallet = await Wallet.fromEncryptedJson(row.encryptedPrivateKey, secret);
  const provider = new JsonRpcProvider(rpcUrlForChain(chainId), chainId);
  return wallet.connect(provider);
}
