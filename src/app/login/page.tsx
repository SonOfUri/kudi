import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getSessionUser()) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <LoginForm />
      <Link
        href="/"
        className="mt-8 text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        ← Back home
      </Link>
    </div>
  );
}
