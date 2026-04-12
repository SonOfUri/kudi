"use client";

import {
  Bell,
  Bot,
  Briefcase,
  Eye,
  FileText,
  Globe,
  Lock,
  User,
} from "lucide-react";
import { useState } from "react";

import { MobileBottomSheet } from "@/components/mobile-bottom-sheet";
import { SettingsGroup } from "@/components/settings-row";
import { SettingsLogoutRow } from "@/components/settings-logout-row";
import { SettingsRowTrigger } from "@/components/settings-row-trigger";

const NEW_BADGE = (
  <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
    New
  </span>
);

export function ProfileSettingsLinks() {
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  const openSoon = () => setComingSoonOpen(true);

  return (
    <>
      <div className="flex flex-col gap-3">
        <SettingsGroup>
          <SettingsRowTrigger icon={Bot} label="Yield Autopilot" badge={NEW_BADGE} onClick={openSoon} />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRowTrigger icon={User} label="Account" onClick={openSoon} />
          <SettingsRowTrigger icon={Globe} label="Language" onClick={openSoon} />
          <SettingsRowTrigger icon={Eye} label="Appearance" onClick={openSoon} />
          <SettingsRowTrigger icon={Lock} label="Security" onClick={openSoon} />
          <SettingsRowTrigger icon={Bell} label="Notification" onClick={openSoon} />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRowTrigger icon={FileText} label="Help" externalStyle onClick={openSoon} />
          <SettingsRowTrigger icon={Briefcase} label="Legal" onClick={openSoon} />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsLogoutRow />
        </SettingsGroup>
      </div>

      <MobileBottomSheet
        open={comingSoonOpen}
        onOpenChange={setComingSoonOpen}
        title="Coming soon"
        showClose
        stackClassName="z-[60]"
      >
        <p className="text-sm leading-relaxed text-muted">
          This isn&apos;t available yet. We&apos;re still building it — thanks for your patience.
        </p>
        <button
          type="button"
          onClick={() => setComingSoonOpen(false)}
          className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm active:bg-primary-hover"
        >
          OK
        </button>
      </MobileBottomSheet>
    </>
  );
}
