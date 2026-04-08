import { permanentRedirect } from "next/navigation";

export default function SignupRedirectPage() {
  permanentRedirect("/onboarding");
}
