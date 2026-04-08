import { permanentRedirect } from "next/navigation";

export default function SplashRedirectPage() {
  permanentRedirect("/get-started");
}
