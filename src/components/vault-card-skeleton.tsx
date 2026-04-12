export function VaultCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
      <div className="size-10 shrink-0 animate-pulse rounded-full bg-neutral-200" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-20 animate-pulse rounded bg-neutral-200" />
        <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="shrink-0 space-y-2 text-right">
        <div className="ml-auto h-6 w-16 animate-pulse rounded bg-neutral-200" />
        <div className="ml-auto h-3 w-12 animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="ml-1 size-8 shrink-0 animate-pulse rounded-lg bg-neutral-100" />
    </div>
  );
}

export function VaultListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <VaultCardSkeleton key={i} />
      ))}
    </div>
  );
}
