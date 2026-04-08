import { cookies } from "next/headers";

import { db } from "@/lib/db";

import { SESSION_COOKIE } from "./constants";
import { verifySessionToken } from "./jwt";

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    const { sub: userId } = await verifySessionToken(token);
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        countryCode: true,
        createdAt: true,
      },
    });
    return user;
  } catch {
    return null;
  }
}
