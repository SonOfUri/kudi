import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";

export default async function SimulationPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-[1.5rem] font-semibold leading-snug tracking-tight text-foreground">Yield over time</h1>
      <p className="text-sm text-muted">Project how your balance could grow at different rates.</p>
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-primary-subtle bg-primary-muted/40">
        <p className="text-center text-sm text-muted">Chart and sliders will mount here.</p>
      </div>
    </div>
  );
}
