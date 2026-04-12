import { ChevronLeft } from "lucide-react";
import Link from "next/link";

type Props = {
  backHref: string;
  backLabel: string;
  title: string;
  backAriaLabel?: string;
};

/** Matches in-app subflows (e.g. Add funds “Back”) + Markets-style page title. */
export function ProfileSettingsHeader({ backHref, backLabel, title, backAriaLabel }: Props) {
  return (
    <header className="flex w-full flex-col gap-1">
      <Link
        href={backHref}
        className="-mt-1 flex w-fit items-center gap-1 text-sm font-semibold text-primary active:opacity-80"
        aria-label={backAriaLabel ?? backLabel}
      >
        <ChevronLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        {backLabel}
      </Link>
      <h1 className="text-[1.5rem] font-semibold leading-snug tracking-tight text-foreground">{title}</h1>
    </header>
  );
}
