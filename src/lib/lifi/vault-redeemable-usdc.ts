import { Contract, JsonRpcProvider, formatUnits } from "ethers";

import { rpcUrlForChain } from "@/lib/custodial-signer";
import { KUDI_QUOTE_FROM_TOKEN } from "@/lib/lifi/constants";

const ERC4626_ABI = [
  "function asset() view returns (address)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
] as const;

/**
 * USDC-denominated vault shares → redeemable USDC (human,6 dp) via ERC-4626.
 * Matches what a full exit quote should approximate; overrides bad Li.fi `balanceUsd` when it works.
 */
export async function redeemableUsdcHumanFromVaultShares(
  vaultAddress: string,
  shareBalanceRawDecimalString: string,
  chainId: number,
): Promise<number | null> {
  if (!/^[0-9]+$/.test(shareBalanceRawDecimalString)) return null;
  let shares: bigint;
  try {
    shares = BigInt(shareBalanceRawDecimalString);
  } catch {
    return null;
  }
  if (shares <= BigInt(0)) return null;

  try {
    const provider = new JsonRpcProvider(rpcUrlForChain(chainId), chainId);
    const vault = new Contract(vaultAddress, ERC4626_ABI, provider);
    const asset = (await vault.asset()) as string;
    if (typeof asset !== "string" || asset.toLowerCase() !== KUDI_QUOTE_FROM_TOKEN.toLowerCase()) {
      return null;
    }
    let assets: bigint;
    try {
      assets = await vault.convertToAssets(shares);
    } catch {
      assets = await vault.previewRedeem(shares);
    }
    const n = Number(formatUnits(assets, 6));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
