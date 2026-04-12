import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  /** Neon cold start can take 30–90s; allow a long connect wait window. */
  const pool = new Pool({
    connectionString: url,
    max: 10,
    connectionTimeoutMillis: 120_000,
    idleTimeoutMillis: 30_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

/**
 * Next.js dev keeps `globalThis` across HMR. A PrismaClient created before
 * `prisma generate` (or before new models existed) will not expose new delegates,
 * which surfaces as `undefined.create`. Recreate when codegen and client disagree.
 */
function clientMatchesCodegen(client: PrismaClient): boolean {
  return typeof client.paycrestOnrampOrder !== "undefined";
}

function getPrisma(): PrismaClient {
  let client = globalForPrisma.prisma;
  if (client && clientMatchesCodegen(client)) {
    return client;
  }
  if (client) {
    void client.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
  client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

/** Lazy proxy so every access runs `getPrisma()` (fixes stale singleton after HMR). */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
