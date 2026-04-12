export function DepositAddressSkeleton() {
  return (
    <div className="flex min-h-[14rem] flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="size-44 animate-pulse rounded-xl bg-neutral-100 ring-1 ring-neutral-200" />
      <div className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-neutral-200" />
      </div>
    </div>
  );
}
