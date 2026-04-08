"use client";

import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type MobileBottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown in the header row next to the close control */
  title?: string;
  children: ReactNode;
  /** Default true. Set false for a fully custom first row inside children. */
  showClose?: boolean;
  /** e.g. z-[60] when this sheet must sit above others */
  stackClassName?: string;
};

/**
 * Mobile-first bottom sheet: dimmed backdrop, panel slides up from the bottom.
 * Mounts via portal to `document.body`. Locks body scroll while open.
 */
export function MobileBottomSheet({
  open,
  onOpenChange,
  title,
  children,
  showClose = true,
  stackClassName = "z-50",
}: MobileBottomSheetProps) {
  const titleId = useId();
  const close = () => onOpenChange(false);

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
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={`fixed inset-0 flex max-h-dvh items-end justify-center ${stackClassName}`}>
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className="animate-kudi-sheet-up relative z-10 max-h-[min(92dvh,840px)] w-[min(100%,var(--app-max-width))] overflow-y-auto overscroll-contain rounded-t-3xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
      >
        {title || showClose ? (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-neutral-100 bg-white px-5 pb-3 pt-4">
            {title ? (
              <h2 id={titleId} className="min-w-0 flex-1 text-lg font-bold leading-snug text-[#16211F]">
                {title}
              </h2>
            ) : (
              <span className="min-w-0 flex-1" aria-hidden />
            )}
            {showClose ? (
              <button
                type="button"
                onClick={close}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white active:bg-neutral-50"
                aria-label="Close"
              >
                <X className="size-5 text-[#16211F]" strokeWidth={1.5} />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
