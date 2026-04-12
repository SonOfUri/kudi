import { KUDI_CHAIN } from "@/lib/kudi-chain";

/** Li.Fi Earn Data API. */
export const LIFI_EARN_BASE = "https://earn.li.fi";

/** Li.Fi Composer (quotes & status). */
export const LIFI_QUEST_QUOTE = "https://li.quest/v1/quote";

/** Base (8453) — see `KUDI_CHAIN`. */
export const KUDI_DEFAULT_CHAIN_ID = KUDI_CHAIN.chainId;

/**
 * USDC on Base — funding token for Composer vault deposits.
 * (Not surfaced in Kudi UI copy.)
 */
export const KUDI_QUOTE_FROM_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export function baseExplorerTx(hash: string) {
  return `https://basescan.org/tx/${hash}`;
}
