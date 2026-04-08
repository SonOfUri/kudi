"use client";

import { MobileBottomSheet } from "@/components/mobile-bottom-sheet";

export type FeedbackModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: "success" | "error";
  /** Defaults: 😊 / 😢 */
  emoji?: string;
  title?: string;
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

/**
 * Success / error feedback as a mobile bottom sheet (same shell as help & avatar sheets).
 */
export function FeedbackModal({
  open,
  onOpenChange,
  variant,
  emoji,
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: FeedbackModalProps) {
  const face = emoji ?? (variant === "success" ? "😊" : "😢");
  const defaultPrimary = variant === "success" ? "Continue" : "OK";
  const faceClass = variant === "success" ? "kudi-feedback-face--happy" : "kudi-feedback-face--sad";

  const close = () => onOpenChange(false);

  const handlePrimary = () => {
    onPrimary?.();
    close();
  };

  const handleSecondary = () => {
    onSecondary?.();
    close();
  };

  return (
    <MobileBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      showClose
      stackClassName="z-[60]"
    >
      <div className="flex flex-col items-center text-center">
        <span className={`select-none text-[4.5rem] leading-none ${faceClass}`} aria-hidden>
          {face}
        </span>
        <p className={`mt-5 text-base leading-relaxed text-neutral-600 ${title ? "" : "mt-6"}`}>{message}</p>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={handlePrimary}
          className="min-h-12 w-full rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground active:bg-primary-hover"
        >
          {primaryLabel ?? defaultPrimary}
        </button>
        {secondaryLabel ? (
          <button
            type="button"
            onClick={handleSecondary}
            className="min-h-12 w-full rounded-xl border border-border px-5 text-base font-medium text-foreground active:bg-primary-muted"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </MobileBottomSheet>
  );
}
