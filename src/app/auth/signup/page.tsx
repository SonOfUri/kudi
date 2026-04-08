import { redirect } from "next/navigation";

/** Legacy URL — sign-up is the `/onboarding` flow after get-started. */
export default function AuthSignupRedirectPage() {
  redirect("/onboarding");
}
