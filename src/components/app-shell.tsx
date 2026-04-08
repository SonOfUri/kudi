"use client";

import type { LucideIcon } from "lucide-react";
import { BarChart3, Home, Landmark, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/simulation", label: "Yield", Icon: BarChart3 },
  { href: "/markets", label: "Markets", Icon: Landmark },
  { href: "/profile", label: "Profile", Icon: User },
];

const iconProps = { className: "size-6 shrink-0", strokeWidth: 1.5 as const, "aria-hidden": true as const };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface-elevated/95 px-4 pb-3 backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/home" className="flex min-h-11 min-w-11 items-center gap-2 py-1 pr-2" aria-label="Kudi home">
          <Image src="/logo/logo.svg" alt="" width={32} height={32} className="size-8 shrink-0" />
          <span className="text-sm font-semibold tracking-tight text-foreground">Kudi</span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-5">{children}</main>

      <nav
        className="fixed bottom-0 left-1/2 z-10 w-full max-w-[min(100%,var(--app-max-width))] -translate-x-1/2 border-t border-border bg-surface-elevated/95 backdrop-blur-md pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        aria-label="Main"
      >
        <ul className="flex w-full justify-between gap-0 px-1">
          {nav.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href} className="min-w-0 flex-1">
                <Link
                  href={href}
                  className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 py-1 text-[11px] font-medium leading-tight transition-colors active:opacity-80 ${
                    active ? "text-primary" : "text-muted"
                  }`}
                >
                  <Icon {...iconProps} />
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
