import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { ProfileLocalAvatar } from "@/components/profile-local-avatar";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-[1.5rem] font-semibold leading-snug tracking-tight text-foreground">Profile</h1>
      <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <LogoutButton />
        <Link
          href="/"
          className="flex min-h-12 items-center justify-center rounded-xl border border-border px-4 text-base font-medium text-foreground active:bg-primary-muted sm:inline-flex"
        >
          Marketing site
        </Link>
      </div>
    </div>
  );
}
