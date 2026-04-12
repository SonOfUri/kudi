/** Bar-chart placeholder for yield / projection charts (matches ~h-64 chart area). */
export function ProjectionChartSkeleton() {
  const bars = 30;
  const heightPct = (i: number) => {
    const t = i / Math.max(1, bars - 1);
    return 22 + t * 70 + (Math.sin(i * 0.35) + 1) * 3;
  };

  return (
    <div
      className="relative h-64 w-full"
      aria-busy="true"
      aria-label="Loading chart"
    >
      <div className="pointer-events-none absolute inset-y-3 left-0 flex w-9 flex-col justify-between py-0.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-2 w-7 animate-pulse rounded bg-neutral-200/90" />
        ))}
      </div>
      <div className="absolute inset-y-3 left-10 right-0 flex items-end justify-between gap-px pl-1">
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            className="min-h-[12%] min-w-0 flex-1 animate-pulse rounded-t-[3px] bg-neutral-200/90"
            style={{ height: `${heightPct(i)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
