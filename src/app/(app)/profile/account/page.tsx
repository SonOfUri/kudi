import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileAddMoneyButton } from "@/components/profile-add-money-button";
import { ProfileSettingsHeader } from "@/components/profile-settings-header";
import { ProfileLocalAvatar } from "@/components/profile-local-avatar";
import { getSessionUser } from "@/lib/auth/session";

export default async function ProfileAccountPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-2">
      <ProfileSettingsHeader
        backHref="/profile"
        backLabel="Settings"
        title="Account"
        backAriaLabel="Back to settings"
      />

      <div className="rounded-2xl border border-border/80 bg-white p-6 shadow-[0_1px_14px_rgba(13,24,21,0.04)]">
        <div className="flex items-start gap-4">
          <ProfileLocalAvatar />
          <div className="min-w-0 flex-1 space-y-4">
            {user.firstName || user.lastName ? (
              <div>
                <p className="text-sm text-muted">Name</p>
                <p className="mt-1 font-medium text-foreground">
                  {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                </p>
              </div>
            ) : null}
            <div>
              <p className="text-sm text-muted">Email</p>
              <p className="mt-1 font-medium text-foreground">{user.email}</p>
            </div>
            {user.countryCode ? (
              <div>
                <p className="text-sm text-muted">Country</p>
                <p className="mt-1 font-medium text-foreground">{user.countryCode}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ProfileAddMoneyButton />

      <Link
        href="/"
        className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-white px-4 text-base font-semibold text-foreground shadow-[0_1px_14px_rgba(13,24,21,0.04)] active:bg-neutral-50/90"
      >
        Marketing site
      </Link>
    </div>
  );
}
