"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DepositSuccessCelebration } from "@/components/deposit-success-celebration";
import { VaultListSkeleton } from "@/components/vault-card-skeleton";
import { KUDI_CHAIN } from "@/lib/kudi-chain";

type EarnVault = {
  address: string;
  chainId: number;
  isTransactional?: boolean;
  analytics?: { apy?: { total?: number } };
};

type VaultsPayload = { data?: EarnVault[]; error?: string };

function dollarsToUsdcBaseUnits(raw: string): string {
  const s = raw.trim();
  if (!s) throw new Error("Enter an amount");
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Enter a valid amount greater than zero");
  }
  const micro = Math.floor(n * 1_000_000);
  if (micro < 1) {
    throw new Error("Amount too small");
  }
  return String(micro);
}

export function MarketsYieldPanel() {
  const [vaults, setVaults] = useState<EarnVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EarnVault | null>(null);
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    explorerUrl: string | null;
    amountLabel: string;
    poolName?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/lifi/vaults", { cache: "no-store" });
      const json = (await res.json()) as VaultsPayload;
      if (!res.ok) {
        throw new Error(json.error || "Could not load yield options");
      }
      const rows = json.data ?? [];
      const depositable = rows.filter(
        (v) => v.isTransactional === true && v.chainId === KUDI_CHAIN.chainId,
      );
      setVaults(depositable);
      setSelected(depositable[0] ?? null);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Could not load yield options");
      setVaults([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAllocate() {
    if (!selected) return;
    setActionError(null);
    setCelebration(null);
    let fromAmount: string;
    try {
      fromAmount = dollarsToUsdcBaseUnits(amount);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Invalid amount");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/lifi/deposit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultAddress: selected.address,
          fromAmount,
          vaultLabel: `Growth pool ${vaults.findIndex((v) => v.address === selected.address && v.chainId === selected.chainId) + 1}`,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        txHash?: string;
        explorerUrl?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || "Allocation failed");
      }
      const amt = Number(amount.trim());
      const amountLabel = Number.isFinite(amt)
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          }).format(amt)
        : "Your deposit";
      const idx = vaults.findIndex((v) => v.address === selected.address && v.chainId === selected.chainId);
      setCelebration({
        explorerUrl: typeof json.explorerUrl === "string" ? json.explorerUrl : null,
        amountLabel,
        poolName: idx >= 0 ? `Growth pool ${idx + 1}` : undefined,
      });
      void load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Allocation failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <VaultListSkeleton count={5} />;
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
        <p className="font-medium">Could not reach yield data</p>
        <p className="mt-1 text-destructive/90">{fetchError}</p>
        <p className="mt-3 text-xs text-muted">
          Set <code className="rounded bg-muted px-1">LIFI_API_KEY</code> in{" "}
          <code className="rounded bg-muted px-1">.env</code> and restart the dev server.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 min-h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  if (vaults.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface-elevated px-4 py-4 text-sm text-muted">
        No allocatable pools right now. Try again later.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Live yield pools</h2>
        <p className="mt-1 text-xs text-muted">
          Rates update from our routing partner. Pick a pool, then allocate from your wallet balance.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {vaults.slice(0, 5).map((v, i) => {
          const apy = v.analytics?.apy?.total;
          const pct = apy != null ? (apy * 100).toFixed(1) : "—";
          const active =
            selected?.address === v.address && selected?.chainId === v.chainId;
          return (
            <li key={`${v.chainId}-${v.address}`}>
              <button
                type="button"
                onClick={() => setSelected(v)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary-muted/50 ring-1 ring-primary/25"
                    : "border-border bg-surface-elevated hover:border-primary/35"
                }`}
              >
                <span className="font-semibold text-foreground">Growth pool {i + 1}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {pct === "—" ? "Estimated rate unavailable" : `~${pct}% estimated yearly rate`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border border-border bg-white px-4 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
          Amount (USD)
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-base font-medium text-foreground outline-none ring-primary/30 focus:ring-2"
          placeholder="e.g. 10"
        />
        <p className="mt-2 text-xs text-muted">
          Allocates from the stable balance in your custodial wallet. A separate small gas balance is
          required for the transfer.
        </p>
      </div>

      {actionError ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy || !selected}
        onClick={() => void onAllocate()}
        className="min-h-12 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
      >
        {busy ? "Working…" : "Allocate to pool"}
      </button>

      {celebration ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          role="dialog"
          aria-modal
          aria-labelledby="deposit-success-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => setCelebration(null)}
          />
          <div className="relative z-10 flex max-h-[90dvh] w-full max-w-[min(100%,var(--app-max-width))] flex-col overflow-y-auto rounded-t-3xl border border-border border-b-0 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-xl">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCelebration(null)}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted active:bg-neutral-100"
                aria-label="Close"
              >
                <X className="size-5 shrink-0" strokeWidth={2} aria-hidden />
              </button>
            </div>
            <DepositSuccessCelebration
              active
              poolName={celebration.poolName}
              amountLabel={celebration.amountLabel}
              explorerUrl={celebration.explorerUrl}
              onDone={() => setCelebration(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
