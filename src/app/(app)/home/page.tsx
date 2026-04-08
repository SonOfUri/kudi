import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";

import { HomeContent } from "./home-content";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <h1 className="text-[1.5rem] font-semibold leading-snug tracking-tight text-foreground">Home</h1>
      <p className="text-sm text-muted">Add money, track yield, move funds when you need them.</p>
      <HomeContent email={user.email} />
    </div>
  );
}
