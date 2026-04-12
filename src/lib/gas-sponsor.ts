import { JsonRpcProvider, parseEther, parseUnits, Wallet } from "ethers";

import { KUDI_CHAIN } from "@/lib/kudi-chain";
import { KUDI_QUOTE_FROM_TOKEN } from "@/lib/lifi/constants";

const DEFAULT_BASE_RPC = "https://mainnet.base.org";

/** Default ~$0.50–1 on Base at typical prices; override with GAS_FUND_ETH. */
const DEFAULT_FUND_ETH = "0.00025";

/** Minimum USDC (human units, 6 decimals) on Base before we sponsor gas — “investment ready”. */
const DEFAULT_MIN_USDC = "1";

function minUsdcBaseUnitsForSponsor(): bigint {
  const raw = process.env.GAS_SPONSOR_MIN_USDC?.trim() ?? DEFAULT_MIN_USDC;
  try {
    return parseUnits(raw, 6);
  } catch {
    return parseUnits(DEFAULT_MIN_USDC, 6);
  }
}

/**
 * On-chain USDC (Base) balance for `address` using the same token as Kudi funding.
 */
export async function fetchUsdcBalanceBaseUnits(walletAddress: string): Promise<bigint> {
  const rpc = process.env.BASE_RPC_URL?.trim() || DEFAULT_BASE_RPC;
  const provider = new JsonRpcProvider(rpc, KUDI_CHAIN.chainId);
  const data = `0x70a08231000000000000000000000000${walletAddress.slice(2).toLowerCase()}`;
  const result = await provider.call({
    to: KUDI_QUOTE_FROM_TOKEN,
    data,
  });
  return BigInt(result);
}

/**
 * True if the wallet holds at least GAS_SPONSOR_MIN_USDC USDC on Base (sponsor gas only when “funded”).
 */
export async function hasMinUsdcForGasSponsor(walletAddress: string): Promise<boolean> {
  const min = minUsdcBaseUnitsForSponsor();
  const bal = await fetchUsdcBalanceBaseUnits(walletAddress);
  return bal >= min;
}

export type GasTopUpResult = { ok: true; txHash: string } | { ok: false };

/**
 * Sends a small ETH top-up from GAS_SPONSOR_PRIVATE_KEY to a custodial address on Base.
 * No-op if env is not configured. Logs and returns `{ ok: false }` on failure.
 */
export async function sendGasTopUpFromSponsor(recipientAddress: string): Promise<GasTopUpResult> {
  const pk = process.env.GAS_SPONSOR_PRIVATE_KEY?.trim();
  if (!pk) {
    return { ok: false };
  }

  const fundEthRaw = process.env.GAS_FUND_ETH?.trim() || DEFAULT_FUND_ETH;
  let value: bigint;
  try {
    value = parseEther(fundEthRaw);
  } catch {
    console.error("[gas-sponsor] Invalid GAS_FUND_ETH:", fundEthRaw);
    return { ok: false };
  }

  const rpc = process.env.BASE_RPC_URL?.trim() || DEFAULT_BASE_RPC;
  const provider = new JsonRpcProvider(rpc, KUDI_CHAIN.chainId);
  const sponsor = new Wallet(pk, provider);

  if (sponsor.address.toLowerCase() === recipientAddress.toLowerCase()) {
    console.warn("[gas-sponsor] Recipient is sponsor wallet; skipping.");
    return { ok: false };
  }

  try {
    const sponsorBal = await provider.getBalance(sponsor.address);
    if (sponsorBal <= value) {
      console.error("[gas-sponsor] Sponsor balance too low (need amount + gas).", {
        sponsor: sponsor.address,
        balanceWei: sponsorBal.toString(),
        sendWei: value.toString(),
      });
      return { ok: false };
    }

    const tx = await sponsor.sendTransaction({
      to: recipientAddress,
      value,
    });
    await tx.wait();
    console.log("[gas-sponsor] Funded", recipientAddress, tx.hash);
    return { ok: true, txHash: tx.hash };
  } catch (e) {
    console.error("[gas-sponsor] Transfer failed:", e);
    return { ok: false };
  }
}

export function isGasSponsorConfigured(): boolean {
  return Boolean(process.env.GAS_SPONSOR_PRIVATE_KEY?.trim());
}
