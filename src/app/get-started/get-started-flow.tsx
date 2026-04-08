"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

/** Sage panel behind sprites (matches earn.svg / shield.svg base) */
const SAGE_PANEL_BG = "#B6CCC7";

/** Headlines + body copy on get-started (6.50% stays `text-primary`) */
const MAIN_HEADLINE = "text-[#16211F]";

const TOTAL_SLIDES = 3;

/** Three splash steps in one client route — no full reloads between slides. */
export function GetStartedFlow() {
  const [index, setIndex] = useState(0);
  const last = index === TOTAL_SLIDES - 1;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <div className="flex flex-1 flex-col pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))]">
        {/* Slide 0 — earn */}
        {index === 0 ? (
          <>
            <div
              className="w-full overflow-hidden "
              
            >
              <Image
                src="/sprite-icons/earn.svg"
                alt=""
                width={440}
                height={464}
                className="block h-auto w-full max-h-[min(52vh,420px)] object-contain object-center"
                priority
              />
            </div>
            <div className="mt-8 flex min-h-0 flex-1 flex-col">
              <h1
                className={`text-center text-[1.35rem] font-medium leading-snug tracking-tight ${MAIN_HEADLINE}`}
              >
                Earn up to <span className="font-bold text-primary">6.50%</span> on your cash with Kudi.
              </h1>
              <p className={`mt-3 text-center text-[0.9375rem] leading-relaxed ${MAIN_HEADLINE}`}>
                Secure your savings and earn interest every second.
              </p>
            </div>
          </>
        ) : null}

        {/* Slide 1 — shield */}
        {index === 1 ? (
          <>
            <div
              className="w-full overflow-hidden "
              
            >
              <Image
                src="/sprite-icons/shield.svg"
                alt=""
                width={440}
                height={469}
                className="block h-auto w-full max-h-[min(52vh,420px)] object-contain object-center"
                priority
              />
            </div>
            <div className="mt-8 flex min-h-0 flex-1 flex-col">
              <h1 className={`text-center text-[1.35rem] font-bold leading-snug tracking-tight ${MAIN_HEADLINE}`}>
                Your Savings.
                <br />
                Protected
              </h1>
              <p className={`mt-3 text-center text-[0.9375rem] leading-relaxed ${MAIN_HEADLINE}`}>
                Industry leading protection on your savings
              </p>
            </div>
          </>
        ) : null}

        {/* Slide 2 — your money */}
        {index === 2 ? (
          <>
            <div className="w-full overflow-hidden " >
              <Image
                src="/sprite-icons/yourmoney.svg"
                alt=""
                width={440}
                height={462}
                className="block h-auto w-full max-h-[min(52vh,420px)] object-contain object-center"
                priority
              />
            </div>
            <div className="mt-8 flex min-h-0 flex-1 flex-col">
              <h1 className={`text-center text-[1.35rem] font-bold leading-snug tracking-tight ${MAIN_HEADLINE}`}>
                Your money.
                <br />
                Your way.
              </h1>
              <p className={`mt-3 text-center text-[0.9375rem] leading-relaxed ${MAIN_HEADLINE}`}>
                No deposit fees and no minimums. Withdraw anytime.
              </p>
            </div>
          </>
        ) : null}

        <div className="flex items-center justify-center gap-2 py-6" aria-hidden>
          {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-8 bg-primary" : "w-1.5 bg-neutral-300"
              }`}
            />
          ))}
        </div>

        <div className="flex w-full flex-col gap-3">
          {!last ? (
            <>
              <button
                type="button"
                onClick={() => setIndex((i) => i + 1)}
                className="min-h-12 w-full rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground active:bg-primary-hover"
              >
                Get Started
              </button>
              <button
                type="button"
                className="min-h-12 w-full rounded-xl border border-border px-5 text-base font-medium text-foreground active:bg-primary-muted"
                onClick={() => setIndex(TOTAL_SLIDES - 1)}
              >
                Skip
              </button>
            </>
          ) : (
            <Link
              href="/onboarding"
              className="flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground active:bg-primary-hover"
            >
              Get Started
            </Link>
          )}
          {last ? (
            <Link
              href="/login"
              className="flex min-h-12 items-center justify-center rounded-xl border border-border px-5 text-center text-base font-medium text-foreground active:bg-primary-muted"
            >
              I already have an account
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
