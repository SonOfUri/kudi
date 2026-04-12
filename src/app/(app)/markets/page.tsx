import { redirect } from "next/navigation";

import { MarketsYieldList } from "@/components/markets-yield-list";
import { getSessionUser } from "@/lib/auth/session";

export default async function MarketsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-[1.5rem] font-semibold leading-snug tracking-tight text-foreground">
        Yield Pools
      </h1>
      <MarketsYieldList />
    </div>
  );
}
