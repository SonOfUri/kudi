import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";

import { HomeContent } from "./home-content";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex w-full flex-col pb-2">
      <HomeContent firstName={user.firstName} email={user.email} />
    </div>
  );
}
