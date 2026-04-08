import { NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth/cookie";
import { createSessionToken } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import {
  CLIENT_DB_UNAVAILABLE_MESSAGE,
  CLIENT_GENERIC_SERVER_MESSAGE,
  isDbConnectionError,
  isDbInvalidCredentialsError,
  withNeonWarmRetry,
} from "@/lib/prisma-errors";
import { credentialsSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "We couldn't read that. Please try again." },
        { status: 400 },
      );
    }

    const parsed = credentialsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check your email and password and try again." },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await withNeonWarmRetry(() =>
      db.user.findUnique({
        where: { email: normalizedEmail },
      }),
    );
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await createSessionToken(user.id, user.email);
    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        countryCode: user.countryCode,
        createdAt: user.createdAt,
      },
    });
    setSessionCookie(res, token);
    return res;
  } catch (err) {
    console.error("[api/auth/login]", err);
    if (isDbInvalidCredentialsError(err)) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[api/auth/login] Postgres rejected DATABASE_URL credentials — update web/.env from Neon, restart dev.",
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
