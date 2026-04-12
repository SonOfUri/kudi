import { NextResponse } from "next/server";
import { Wallet } from "ethers";

import { setSessionCookie } from "@/lib/auth/cookie";
import { createSessionToken } from "@/lib/auth/jwt";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  CLIENT_DB_UNAVAILABLE_MESSAGE,
  CLIENT_GENERIC_SERVER_MESSAGE,
  isDbConnectionError,
  isDbInvalidCredentialsError,
  withNeonWarmRetry,
} from "@/lib/prisma-errors";
import { formatSignupValidationError } from "@/lib/signup-errors";
import { normalizeSignupProfile, signupSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "We couldn't read that. Please go back and try again." },
        { status: 400 },
      );
    }

    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatSignupValidationError(parsed.error) },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const profile = normalizeSignupProfile(parsed.data);
    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await hashPassword(password);

    const outcome = await withNeonWarmRetry(async () => {
      const existing = await db.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing) {
        return { kind: "exists" as const };
      }

      const secret = process.env.AUTH_SECRET;
      if (!secret || secret.length < 16) {
        throw new Error("AUTH_SECRET must be at least 16 characters.");
      }
      const ethWallet = Wallet.createRandom();
      const encryptedPrivateKey = await ethWallet.encrypt(secret);

      try {
        const user = await db.$transaction(async (tx) => {
          const u = await tx.user.create({
            data: {
              email: normalizedEmail,
              passwordHash,
              firstName: profile.firstName,
              lastName: profile.lastName,
              countryCode: profile.countryCode,
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              countryCode: true,
              createdAt: true,
            },
          });
          await tx.wallet.create({
            data: {
              userId: u.id,
              address: ethWallet.address,
              encryptedPrivateKey,
            },
          });
          return u;
        });
        return { kind: "created" as const, user };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return { kind: "exists" as const };
        }
        throw err;
      }
    });

    if (outcome.kind === "exists") {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const token = await createSessionToken(outcome.user.id, outcome.user.email);
    const res = NextResponse.json({ user: outcome.user });
    setSessionCookie(res, token);
    return res;
  } catch (err) {
    console.error("[api/auth/signup]", err);
    if (isDbInvalidCredentialsError(err)) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[api/auth/signup] Postgres rejected DATABASE_URL credentials — update web/.env from Neon, restart dev.",
        );
      }
      return NextResponse.json({ error: CLIENT_GENERIC_SERVER_MESSAGE }, { status: 500 });
    }
    if (isDbConnectionError(err)) {
      return NextResponse.json({ error: CLIENT_DB_UNAVAILABLE_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: CLIENT_GENERIC_SERVER_MESSAGE }, { status: 500 });
  }
}
