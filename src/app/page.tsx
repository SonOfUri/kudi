import { redirect } from "next/navigation";

import { PreloaderClient } from "@/app/preloader-client";
import { getSessionUser } from "@/lib/auth/session";

export default async function HomePage() {
  if (await getSessionUser()) {
    redirect("/home");
  }

  return <PreloaderClient />;
}
