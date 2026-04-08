"use client";

import { useEffect, useState } from "react";

import { KUDI_LOCAL_PROFILE_KEY } from "@/lib/kudi-local-profile";

/** Renders onboarding avatar emoji from `localStorage` (not stored on the server). */
export function ProfileLocalAvatar() {
  const [emoji, setEmoji] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KUDI_LOCAL_PROFILE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { avatarEmoji?: unknown };
      if (typeof parsed.avatarEmoji === "string" && parsed.avatarEmoji.length > 0) {
        setEmoji(parsed.avatarEmoji);
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (!emoji) return null;

  return (
    <span
      className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-muted text-3xl"
      aria-hidden
    >
      {emoji}
    </span>
  );
}
