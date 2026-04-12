"use client";

import type { LucideIcon } from "lucide-react";
import { Home, Landmark, PieChart, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/portfolio", label: "Portfolio", Icon: PieChart },
  { href: "/markets", label: "Markets", Icon: Landmark },
  { href: "/profile", label: "Profile", Icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <main className="flex flex-1 flex-col px-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      <nav
        className="pointer-events-none fixed bottom-0 left-1/2 z-10 w-full max-w-[min(100%,var(--app-max-width))] -translate-x-1/2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-0"
        aria-label="Main"
      >
        <ul className="pointer-events-auto flex w-full items-stretch justify-between gap-0 border-0 bg-surface py-2">
          {nav.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href} className="flex min-w-0 flex-1 justify-center">
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={`flex size-12 max-w-[3.75rem] flex-1 items-center justify-center rounded-xl transition-[transform,background-color,color,box-shadow] duration-200 active:scale-[0.94] ${
                    active
                      ? "bg-primary-muted text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                      : "text-muted hover:bg-black/[0.03] hover:text-foreground"
                  }`}
                >
                  <Icon
                    className="size-6 shrink-0"
                    strokeWidth={active ? 2 : 1.5}
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
