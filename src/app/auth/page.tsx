import { redirect } from "next/navigation";

/** Legacy hub — use `/login` or `/onboarding`. */
export default function AuthPage() {
  redirect("/login");
}
