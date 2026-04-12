"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronRight, ExternalLink } from "lucide-react";

type Props = {
  icon: LucideIcon;
  label: string;
  badge?: React.ReactNode;
  /** Use the external-link affordance (e.g. Help). */
  externalStyle?: boolean;
  onClick: () => void;
};

const rowClass =
  "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-neutral-50/90";

export function SettingsRowTrigger({ icon: Icon, label, badge, externalStyle, onClick }: Props) {
  return (
    <button type="button" onClick={onClick} className={rowClass}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
        <Icon className="size-5" strokeWidth={2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-base font-medium text-foreground">{label}</span>
      {badge ? <span className="shrink-0">{badge}</span> : null}
      {externalStyle ? (
        <ExternalLink className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}
