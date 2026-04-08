import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";

import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  if (await getSessionUser()) {
    redirect("/home");
  }

  return <OnboardingWizard />;
}
