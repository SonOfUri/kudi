"use client";

import { useRouter } from "next/navigation";

import { clearKudiLocalProfile } from "@/lib/kudi-local-profile";

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
        clearKudiLocalProfile();
        router.push("/login");
        router.refresh();
      }}
      className="min-h-12 w-full rounded-xl bg-primary px-6 text-base font-medium text-primary-foreground active:bg-primary-hover sm:w-auto"
    >
      Log out
    </button>
  );
}
