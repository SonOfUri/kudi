import { redirect } from "next/navigation";

import { ProfileSettingsHeader } from "@/components/profile-settings-header";
import { ProfileSettingsLinks } from "@/components/profile-settings-links";
import { getSessionUser } from "@/lib/auth/session";

import packageJson from "../../../../package.json";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-2">
      <ProfileSettingsHeader backHref="/home" backLabel="Home" title="Settings" backAriaLabel="Back to home" />

      <ProfileSettingsLinks />

      <p className="text-center text-xs text-muted">V {packageJson.version}</p>
    </div>
  );
}
