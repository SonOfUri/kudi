"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const BRAND_HOLD_MS = 2800;
const BRAND_HOLD_REDUCED_MS = 700;

/** `/` only: full-screen brand hold, then client navigation to `/get-started` (no full reload). */
export function PreloaderClient() {
  const router = useRouter();

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? BRAND_HOLD_REDUCED_MS : BRAND_HOLD_MS;
    const t = window.setTimeout(() => {
      router.replace("/get-started");
    }, ms);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-[#095342] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      aria-busy="true"
      aria-label="Loading"
    >
      <Image
        src="/logo/logo-white.svg"
        alt="Kudi"
        width={120}
        height={122}
        className="h-auto w-[7.5rem] max-w-[42vw] drop-shadow-sm"
        priority
      />
    </div>
  );
}
