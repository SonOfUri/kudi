"use client";

import { Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MobileBottomSheet } from "@/components/mobile-bottom-sheet";
import { clearKudiLocalProfile } from "@/lib/kudi-local-profile";

export function SettingsLogoutRow() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function performLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setLogoutError("Could not log out. Please try again.");
        return;
      }
      clearKudiLocalProfile();
      setConfirmOpen(false);
      router.push("/login");
      router.refresh();
    } catch {
      setLogoutError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-neutral-50/90"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
          <LogOut className="size-5" strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-base font-medium text-foreground">Log out</span>
      </button>

      <MobileBottomSheet
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!loggingOut) {
            setConfirmOpen(open);
            if (!open) setLogoutError(null);
          }
        }}
        title="Log out?"
        showClose
        stackClassName="z-[60]"
      >
        <p className="text-sm leading-relaxed text-muted">
          You&apos;ll need to sign in again to use your Kudi wallet and balances.
        </p>
        {logoutError ? (
          <p className="mt-3 text-sm font-medium text-red-600" role="alert">
            {logoutError}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => setConfirmOpen(false)}
            className="flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-white px-4 text-base font-semibold text-foreground shadow-[0_1px_14px_rgba(13,24,21,0.04)] disabled:opacity-50 active:bg-neutral-50/90"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void performLogout()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50 active:bg-primary-hover"
          >
            {loggingOut ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Logging out…
              </>
            ) : (
              "Log out"
            )}
          </button>
        </div>
      </MobileBottomSheet>
    </>
  );
}
