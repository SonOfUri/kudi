import { ProjectionChartSkeleton } from "@/components/projection-chart-skeleton";

export default function SimulationLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="space-y-3">
        <div className="h-9 w-36 animate-pulse rounded-lg bg-neutral-200" />
        <div className="h-4 w-full max-w-[min(100%,20rem)] animate-pulse rounded bg-neutral-100" />
        <div className="h-4 w-full max-w-[min(100%,18rem)] animate-pulse rounded bg-neutral-100" />
      </div>

      <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_12px_rgba(13,24,21,0.045)]">
        <div className="flex items-center justify-between gap-3">
          <div className="h-9 w-[4.5rem] animate-pulse rounded-xl bg-neutral-100" />
          <div className="h-4 w-14 animate-pulse rounded bg-neutral-100" />
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="h-4 w-20 animate-pulse rounded-md bg-neutral-200" />
          <div className="h-4 w-28 animate-pulse rounded-md bg-neutral-100" />
          <div className="h-14 w-52 max-w-full animate-pulse rounded-lg bg-neutral-200" />
          <div className="h-5 w-64 max-w-full animate-pulse rounded-md bg-neutral-100" />
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-neutral-50 p-4">
          <ProjectionChartSkeleton />
          <div className="mt-3 flex items-center justify-between">
            <div className="h-3 w-6 animate-pulse rounded bg-neutral-200/80" />
            <div className="h-3 w-24 animate-pulse rounded bg-neutral-200/80" />
            <div className="h-3 w-7 animate-pulse rounded bg-neutral-200/80" />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-neutral-50 px-5 py-4">
          <div className="min-w-0 space-y-2">
            <div className="h-6 w-40 animate-pulse rounded-md bg-neutral-200" />
            <div className="h-4 w-28 animate-pulse rounded bg-neutral-100" />
          </div>
          <div className="h-10 w-[7.5rem] shrink-0 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}
