import Link from "next/link";

import { getSessionUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getSessionUser();

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-24 dark:bg-zinc-950">
      <main className="max-w-md text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Kudi
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Add money. Start earning.
        </h1>
        <p className="mt-4 text-pretty text-zinc-600 dark:text-zinc-400">
          A simpler way to grow your balance—without dealing with crypto
          complexity.
        </p>
        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Open app
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Sign up
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
