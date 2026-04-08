import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";

export default async function MarketsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-[1.5rem] font-semibold leading-snug tracking-tight text-foreground">Markets</h1>
      <p className="text-sm text-muted">Rates, underlying assets, and education in one place.</p>
      <ul className="flex flex-col gap-3">
        {["Stable yield tier", "Growth tier", "Learn"].map((title) => (
          <li
            key={title}
            className="rounded-xl border border-border bg-surface-elevated px-4 py-4 text-sm font-medium text-foreground shadow-sm"
          >
            {title}
            <span className="mt-1 block text-xs font-normal text-muted">Details coming soon.</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
