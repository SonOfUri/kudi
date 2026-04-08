import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
});

/** Sign-up body: credentials plus optional profile from onboarding (skip steps may omit). Avatar stays client-only. */
export const signupSchema = credentialsSchema.extend({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  countryCode: z.string().max(8).optional(),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

function trimOrNull(value: string | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/** Normalize optional signup profile strings for Prisma (empty → null). */
export function normalizeSignupProfile(input: SignupInput) {
  return {
    firstName: trimOrNull(input.firstName),
    lastName: trimOrNull(input.lastName),
    countryCode: trimOrNull(input.countryCode)?.toUpperCase() ?? null,
  };
}
