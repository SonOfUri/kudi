import type { Prisma } from "@/generated/prisma/client";
import type { WalletActivityType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export type RecordWalletActivityInput = {
  userId: string;
  type: WalletActivityType;
  amountUsdcBaseUnits?: string | null;
  txHash?: string | null;
  explorerUrl?: string | null;
  meta?: Prisma.InputJsonValue;
};

/**
 * Persists a user-visible activity row. Never throws to callers — logs on failure.
 */
export async function recordWalletActivity(input: RecordWalletActivityInput): Promise<void> {
  try {
    await db.walletActivity.create({
      data: {
        userId: input.userId,
        type: input.type,
        amountUsdcBaseUnits: input.amountUsdcBaseUnits ?? null,
        txHash: input.txHash ?? null,
        explorerUrl: input.explorerUrl ?? null,
        meta: input.meta === undefined ? undefined : input.meta,
      },
    });
  } catch (e) {
    console.error("[wallet-activity] Failed to record activity:", e);
  }
}
