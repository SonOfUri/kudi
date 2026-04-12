"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { SimulationInputModal } from "@/components/simulation-input-modal";
import { SimulationResultsView } from "@/components/simulation-results";

const DEFAULT_AMOUNT = 500;
const DEFAULT_MONTHLY = true;

type SimulationContentProps = {
  topVaultApy: number;
  topVaultName?: string;
  fetchError: string | null;
};

export function SimulationContent({ topVaultApy, topVaultName, fetchError }: SimulationContentProps) {
  const [simInputOpen, setSimInputOpen] = useState(false);
  const [simAmount, setSimAmount] = useState(DEFAULT_AMOUNT);
  const [simIsMonthly, setSimIsMonthly] = useState(DEFAULT_MONTHLY);

  const openEdit = useCallback(() => {
    setSimInputOpen(true);
  }, []);

  const vaultLabel = topVaultName ?? "Top Markets pool";

  if (fetchError) {
    return (
      <div className="flex w-full flex-col gap-4">
        <h1 className="text-[1.5rem] font-semibold leading-snug tracking-tight text-foreground">Simulate</h1>
        <p className="text-sm leading-relaxed text-muted">
          We couldn&apos;t load live rates ({fetchError}). Try again in a moment or open Markets from the tab
          bar.
        </p>
        <Link
          href="/markets"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-sm active:scale-[0.98] active:bg-primary-hover"
        >
          Go to Markets
        </Link>
      </div>
    );
  }

  if (topVaultApy <= 0) {
    return (
      <div className="flex w-full flex-col gap-4">
        <h1 className="text-[1.5rem] font-semibold leading-snug tracking-tight text-foreground">Simulate</h1>
        <p className="text-sm leading-relaxed text-muted">
          No transactional yield pools with an APY showed up from Markets. Open Markets to pick a pool and run
          Simulate from there.
        </p>
        <Link
          href="/markets"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-sm active:scale-[0.98] active:bg-primary-hover"
        >
          Go to Markets
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex w-full flex-col gap-6">
        <div>
          <h1 className="text-[1.5rem] font-semibold leading-snug tracking-tight text-foreground">Simulate</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Uses the{" "}
            <span className="font-medium text-foreground">highest APY on Markets right now</span> (
            {topVaultApy.toFixed(2)}%, {vaultLabel}).{" "}
            <Link href="/markets" className="font-semibold text-primary underline-offset-2 hover:underline">
              Browse pools
            </Link>
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_12px_rgba(13,24,21,0.045)]">
          <SimulationResultsView
            apy={topVaultApy}
            amount={simAmount}
            isMonthly={simIsMonthly}
            vaultName={vaultLabel}
            onEdit={openEdit}
            topBar={{ variant: "page" }}
          />
        </div>
      </div>

      <SimulationInputModal
        open={simInputOpen}
        onClose={() => setSimInputOpen(false)}
        currentAmount={simAmount}
        currentIsMonthly={simIsMonthly}
        onSimulate={(amt, monthly) => {
          setSimAmount(amt);
          setSimIsMonthly(monthly);
          setSimInputOpen(false);
        }}
      />
    </>
  );
}
