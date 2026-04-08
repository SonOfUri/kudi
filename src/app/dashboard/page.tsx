import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";

import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-1 flex-col gap-8 px-4 py-16">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Kudi
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Home
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {user.email}
          </span>
        </p>
      </header>

      <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/50">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Balance and yield UI from the MVP spec will go here. Your session is
          active; wallet creation and deposits can plug in next.
        </p>
      </section>

      <div className="flex flex-wrap gap-4">
        <LogoutButton />
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Landing
        </Link>
      </div>
    </div>
  );
}
