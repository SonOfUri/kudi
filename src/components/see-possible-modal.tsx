"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

import { MobileSheetNotch } from "@/components/mobile-bottom-sheet";

const STORAGE_KEY = "kudi_see_possible_modal_dismissed";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function dismiss() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

/** @returns whether the user has already dismissed the modal (browser only). */
export function hasSeePossibleModalDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * Full-screen intro for users with no USDC and no portfolio balance.
 * Single-tap X to close and stop showing; primary CTA links to Simulation.
 */
export function SeePossibleModal({ open, onOpenChange }: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  const close = () => {
    dismiss();
    onOpenChange(false);
  };

  const goSimulation = () => {
    dismiss();
    onOpenChange(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="flex flex-col items-stretch px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex justify-center pb-2">
          <MobileSheetNotch />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={close}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-foreground shadow-sm ring-1 ring-black/[0.04] active:bg-neutral-50"
            aria-label="Close"
          >
            <X className="size-6" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <h2 id={titleId} className="text-center text-[1.5rem] font-semibold leading-snug tracking-tight text-foreground">
          See what&apos;s possible
        </h2>
        <p className="mx-auto mt-4 max-w-sm text-center text-base leading-relaxed text-muted">
          You don&apos;t have funds here yet. Explore a quick simulation with live pool rates — no deposit
          required.
        </p>
        <Link
          href="/simulation"
          onClick={goSimulation}
          className="mx-auto mt-8 flex min-h-12 w-full max-w-xs items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm active:scale-[0.99] active:bg-primary-hover"
        >
          Open simulation
        </Link>
      </div>
    </div>,
    document.body,
  );
}
