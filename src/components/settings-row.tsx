import type { LucideIcon } from "lucide-react";
import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

const GROUP_CARD =
  "overflow-hidden rounded-2xl border border-border/80 bg-white shadow-[0_1px_14px_rgba(13,24,21,0.04)]";

export function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className={GROUP_CARD}>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}

type SettingsRowLinkProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  external?: boolean;
  badge?: React.ReactNode;
};

export function SettingsRowLink({ href, icon: Icon, label, external, badge }: SettingsRowLinkProps) {
  const className =
    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-neutral-50/90";

  const inner = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
        <Icon className="size-5" strokeWidth={2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-base font-medium text-foreground">{label}</span>
      {badge ? <span className="shrink-0">{badge}</span> : null}
      {external ? (
        <ExternalLink className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
      )}
    </>
  );

  if (external) {
    const isMailto = href.startsWith("mailto:");
    return (
      <a
        href={href}
        {...(isMailto ? {} : { target: "_blank", rel: "noopener noreferrer" })}
        className={className}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}
