"use client";

import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type DepositSuccessCelebrationProps = {
  /** When true, plays confetti once */
  active: boolean;
  poolName?: string;
  /** e.g. "$120.00" */
  amountLabel: string;
  explorerUrl: string | null;
  onDone: () => void;
};

const CONFETTI_COLORS = ["#095342", "#22c55e", "#fbbf24", "#34d399", "#86efac", "#38bdf8"];

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function fireCelebrationConfetti(cancelled: () => boolean) {
  void import("canvas-confetti").then((mod) => {
    if (cancelled()) return;
    const confetti = mod.default;
    const end = Date.now() + 2800;
    const tick = () => {
      if (cancelled()) return;
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.72 },
        colors: CONFETTI_COLORS,
        ticks: 200,
        gravity: 1.05,
        scalar: 0.9,
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.72 },
        colors: CONFETTI_COLORS,
        ticks: 200,
        gravity: 1.05,
        scalar: 0.9,
      });
      if (Date.now() < end && !cancelled()) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
    confetti({
      particleCount: 100,
      spread: 88,
      startVelocity: 38,
      origin: { y: 0.58 },
      colors: CONFETTI_COLORS,
      ticks: 320,
      gravity: 0.95,
      scalar: 1.05,
    });
    window.setTimeout(() => {
      if (!cancelled()) {
        confetti({
          particleCount: 45,
          angle: 90,
          spread: 100,
          origin: { x: 0.5, y: 0.35 },
          colors: CONFETTI_COLORS,
          ticks: 280,
        });
      }
    }, 180);
  });
}

function buildShareText(amountLabel: string, poolName: string | undefined, pageUrl: string) {
  const pool = poolName?.trim() ? ` in “${poolName.trim()}”` : "";
  const body = `I just deposited ${amountLabel} into a yield pool${pool} on Kudi — putting my stablecoins to work on Base.`;
  return pageUrl.trim() ? `${body} ${pageUrl.trim()}` : body;
}

export function DepositSuccessCelebration({
  active,
  poolName,
  amountLabel,
  explorerUrl,
  onDone,
}: DepositSuccessCelebrationProps) {
  const firedRef = useRef(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!active) {
      firedRef.current = false;
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;
    let dead = false;
    fireCelebrationConfetti(() => dead);
    return () => {
      dead = true;
    };
  }, [active]);

  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/portfolio` : "";

  const shareText = buildShareText(amountLabel, poolName, pageUrl);

  const shareNative = useCallback(async () => {
    setSharing(true);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        const url =
          pageUrl.trim() ||
          (typeof window !== "undefined" ? window.location.href : "");
        await navigator.share({
          title: "Deposit sent — Kudi",
          text: shareText,
          ...(url ? { url } : {}),
        });
      }
    } catch {
      // user cancelled or share failed
    } finally {
      setSharing(false);
    }
  }, [pageUrl, shareText]);

  const openX = useCallback(() => {
    const urlParam =
      pageUrl.trim() ||
      (typeof window !== "undefined" ? window.location.href : "");
    const textOnly = buildShareText(amountLabel, poolName, "");
    const qs = new URLSearchParams();
    qs.set("text", textOnly);
    if (urlParam) qs.set("url", urlParam);
    const u = `https://twitter.com/intent/tweet?${qs.toString()}`;
    window.open(u, "_blank", "noopener,noreferrer");
  }, [amountLabel, pageUrl, poolName]);

  const openLinkedIn = useCallback(() => {
    const target = pageUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (!target) return;
    const u = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(target)}`;
    window.open(u, "_blank", "noopener,noreferrer");
  }, [pageUrl]);

  const copyShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [shareText]);

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (!active) return null;

  return (
    <div className="relative flex flex-col items-center px-1 pb-1 pt-2">
      <div
        className="pointer-events-none absolute -inset-x-6 -top-8 bottom-0 overflow-hidden rounded-t-3xl opacity-[0.14]"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,#22c55e_0%,transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_100%_40%,#fbbf24_0%,transparent_45%)]" />
      </div>

      <div className="relative flex flex-col items-center text-center">
        <div className="relative flex size-[4.5rem] items-center justify-center">
          <div
            className="absolute inset-0 animate-[ping_1.2s_ease-out_1] rounded-full bg-[#22c55e]/25"
            aria-hidden
          />
          <div
            className="absolute inset-1 rounded-full bg-gradient-to-br from-[#22c55e] to-[#059669] shadow-[0_12px_32px_rgba(5,150,105,0.45)]"
            aria-hidden
          />
          <div className="relative flex size-[3.25rem] items-center justify-center rounded-full bg-white/15 backdrop-blur-[2px]">
            <Check className="size-9 text-white drop-shadow-sm" strokeWidth={2.75} aria-hidden />
          </div>
        </div>

        <h2
          id="deposit-success-title"
          className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]"
        >
          You&apos;re earning!
        </h2>
        <p className="mt-2 max-w-[20rem] text-sm leading-relaxed text-muted">
          <span className="font-semibold text-foreground">{amountLabel}</span>
          {poolName?.trim() ? (
            <>
              {" "}
              is headed to{" "}
              <span className="font-medium text-foreground line-clamp-2">{poolName.trim()}</span>
            </>
          ) : (
            <> is on its way to your yield pool</>
          )}
          . It may take a moment to confirm on-chain.
        </p>
      </div>

      <div className="relative mt-6 w-full rounded-2xl border border-primary/15 bg-gradient-to-b from-primary-muted/80 to-white px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          Share the win
        </p>
        <p className="mt-1 text-center text-[13px] leading-snug text-muted">
          Tell friends you&apos;re putting idle cash to work — no hype, just yield.
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {canNativeShare ? (
            <button
              type="button"
              onClick={() => void shareNative()}
              disabled={sharing}
              className="flex min-h-11 min-w-[7.5rem] flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_4px_14px_rgba(9,83,66,0.35)] active:scale-[0.98] active:bg-primary-hover disabled:opacity-60"
            >
              {sharing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Share2 className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
              )}
              Share
            </button>
          ) : null}

          <button
            type="button"
            onClick={openX}
            className="flex min-h-11 min-w-[7.5rem] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground shadow-sm active:bg-neutral-50"
            aria-label="Share on X"
          >
            <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            X
          </button>

          <button
            type="button"
            onClick={openLinkedIn}
            className="flex min-h-11 min-w-[7.5rem] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground shadow-sm active:bg-neutral-50"
            aria-label="Share on LinkedIn"
          >
            <LinkedInIcon className="size-4 shrink-0 text-[#0A66C2]" />
            LinkedIn
          </button>

          <button
            type="button"
            onClick={() => void copyShare()}
            className="flex min-h-11 min-w-[7.5rem] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground shadow-sm active:bg-neutral-50"
          >
            {copied ? (
              <Check className="size-4 shrink-0 text-[#15803d]" strokeWidth={2.5} aria-hidden />
            ) : (
              <Copy className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            )}
            {copied ? "Copied" : "Copy text"}
          </button>
        </div>
      </div>

      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative mt-4 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          View transaction on explorer
        </a>
      ) : null}

      <button
        type="button"
        onClick={onDone}
        className="relative mt-6 flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-primary/20 bg-white px-4 text-base font-semibold text-primary shadow-sm active:bg-primary-muted/40"
      >
        Done
      </button>
    </div>
  );
}
