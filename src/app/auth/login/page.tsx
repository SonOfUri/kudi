import { redirect } from "next/navigation";

/** Legacy URL — sign-in uses `/login` (onboarding-style screen). */
export default function AuthLoginRedirectPage() {
  redirect("/login");
}
