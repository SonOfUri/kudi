import { AppShell } from "@/components/app-shell";

export default function AppGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <AppShell>{children}</AppShell>
    </div>
  );
}
