import { Prisma } from "@/generated/prisma/client";

/**
 * Safe copy returned in API JSON when the app cannot reach Postgres in time (cold start, network blip).
 * Technical detail belongs in server logs only.
 */
export const CLIENT_DB_UNAVAILABLE_MESSAGE =
  "We're having trouble connecting right now. Please wait a few seconds and try again.";

/**
 * Safe copy for unexpected 5xx (including misconfigured DB credentials — fix in env, log server-side only).
 */
export const CLIENT_GENERIC_SERVER_MESSAGE =
  "Something went wrong on our end. Please try again in a moment.";

const CONNECTION_LIKE_CODES = new Set<string>([
  "P1001",
  "P1002",
  "P1017",
  "ETIMEDOUT",
]);

/** True when Postgres rejected the credentials in DATABASE_URL (Prisma P1000 or equivalent). */
export function isDbInvalidCredentialsError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P1000") {
    return true;
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return err.message.includes("Authentication failed");
  }
  return false;
}

/** True when failure is likely DB unreachable / slow wake (e.g. Neon scale-from-zero). */
export function isDbConnectionError(err: unknown): boolean {
  if (isDbInvalidCredentialsError(err)) {
    return false;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return CONNECTION_LIKE_CODES.has(err.code);
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  return false;
}

/** One slow reconnect after ~4s when Neon was asleep (cold start). */
export async function withNeonWarmRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isDbConnectionError(err)) {
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 4500));
    return await fn();
  }
}
