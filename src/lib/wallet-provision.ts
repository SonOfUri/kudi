import { Wallet } from "ethers";

import { db } from "@/lib/db";
import {
  hasMinUsdcForGasSponsor,
  isGasSponsorConfigured,
  sendGasTopUpFromSponsor,
} from "@/lib/gas-sponsor";
import { baseExplorerTx } from "@/lib/lifi/constants";
import { recordWalletActivity } from "@/lib/wallet-activity";
import { WalletActivityType } from "@/generated/prisma/enums";

const MIN_SECRET_LEN = 16;

function maxGasSponsorAttempts(): number {
  const n = Number(process.env.GAS_SPONSOR_MAX_ATTEMPTS ?? "4");
  if (!Number.isFinite(n)) return 4;
  return Math.min(10, Math.max(1, Math.floor(n)));
}

/**
 * One funded attempt per call, capped by gasSponsorAttempts, until gasSponsoredAt is set.
 */
async function tryGasSponsorForUser(userId: string, address: string) {
  if (!isGasSponsorConfigured()) {
    return;
  }

  const row = await db.wallet.findUnique({
    where: { userId },
    select: { gasSponsoredAt: true, gasSponsorAttempts: true },
  });
  if (!row || row.gasSponsoredAt) {
    return;
  }

  const cap = maxGasSponsorAttempts();
  if (row.gasSponsorAttempts >= cap) {
    return;
  }

  try {
    const funded = await hasMinUsdcForGasSponsor(address);
    if (!funded) {
      return;
    }
  } catch (e) {
    console.error("[wallet-provision] USDC balance check for gas sponsor failed:", e);
    return;
  }

  const claimed = await db.wallet.updateMany({
    where: {
      userId,
      gasSponsoredAt: null,
      gasSponsorAttempts: { lt: cap },
    },
    data: { gasSponsorAttempts: { increment: 1 } },
  });
  if (claimed.count === 0) {
    return;
  }

  const sent = await sendGasTopUpFromSponsor(address);
  if (sent.ok) {
    await db.wallet.update({
      where: { userId },
      data: { gasSponsoredAt: new Date() },
    });
    const fundEth = process.env.GAS_FUND_ETH?.trim() || "0.00025";
    await recordWalletActivity({
      userId,
      type: WalletActivityType.GAS_SUBSIDY,
      explorerUrl: baseExplorerTx(sent.txHash),
      txHash: sent.txHash,
      meta: { ethAmountLabel: fundEth, purpose: "network_fee_support" },
    });
  }
}

/**
 * Ensure the user has a `Wallet` row with a real EVM address and JSON keystore in
 * `encryptedPrivateKey` (encrypted with `AUTH_SECRET`). Creates one on first use so
 * existing accounts upgrade without a migration.
 *
 * When `GAS_SPONSOR_PRIVATE_KEY` is set and the wallet holds at least `GAS_SPONSOR_MIN_USDC` USDC
 * on Base, we may send a small ETH top-up for gas (see `.env.example`).
 */
export async function ensureUserWallet(userId: string) {
  const existing = await db.wallet.findUnique({
    where: { userId },
    select: { address: true },
  });
  if (existing) {
    await tryGasSponsorForUser(userId, existing.address);
    return existing;
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < MIN_SECRET_LEN) {
    throw new Error(
      `AUTH_SECRET must be set and at least ${MIN_SECRET_LEN} characters to provision wallets.`,
    );
  }

  const w = Wallet.createRandom();
  const encryptedPrivateKey = await w.encrypt(secret);

  try {
    const row = await db.wallet.create({
      data: {
        userId,
        address: w.address,
        encryptedPrivateKey,
      },
      select: { address: true },
    });
    await tryGasSponsorForUser(userId, row.address);
    return row;
  } catch {
    const again = await db.wallet.findUnique({
      where: { userId },
      select: { address: true },
    });
    if (again) {
      await tryGasSponsorForUser(userId, again.address);
      return again;
    }
    throw new Error("Could not create wallet.");
  }
}
