"use client";

import { ExternalLink, TrendingUp, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { KUDI_CHAIN } from "@/lib/kudi-chain";
import { ProtocolLogo } from "@/components/protocol-logo";
import { SimulationInputModal } from "@/components/simulation-input-modal";
import { SimulationResults } from "@/components/simulation-results";
import { VaultInvestModal } from "@/components/vault-invest-modal";

type VaultDetailProps = {
  vault: {
    address: string;
    chainId: number;
    slug?: string;
    isTransactional?: boolean;
    name?: string;
    protocol?: { name?: string; url?: string };
    underlyingTokens?: Array<{ symbol?: string; address?: string; decimals?: number }>;
    analytics?: {
      apy?: { total?: number; base?: number; reward?: number };
      tvl?: { usd?: string };
    };
  };
  open: boolean;
  onClose: () => void;
};

function formatTvl(usd: string | undefined): string {
  if (!usd) return "—";
  const n = Number(usd);
  if (!Number.isFinite(n) || n < 1) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
}

function formatApy(apy: number | undefined): string {
  if (apy == null || !Number.isFinite(apy)) return "—";
  return `${apy.toFixed(2)}%`;
}

function protocolDisplayName(protocolName: string | undefined): string {
  if (!protocolName) return "Unknown";
  if (protocolName === "morpho-v1") return "Morpho V1";
  if (protocolName === "aave-v3") return "Aave V3";
  if (protocolName === "yo-protocol") return "Yo Protocol";
  if (protocolName === "pendle") return "Pendle";
  if (protocolName.toLowerCase().startsWith("euler")) return "Euler";
  return protocolName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function tokenLogoPath(symbol: string | undefined): string | null {
  if (!symbol) return null;
  const s = symbol.toLowerCase();
  if (s === "usdc") return "/crypto/usdc.svg";
  if (s === "usdt") return "/crypto/usdt.svg";
  if (s === "eurc") return "/crypto/eurc.svg";
  return null;
}

function tokenInitial(symbol: string | undefined): string {
  if (!symbol) return "?";
  return symbol.charAt(0).toUpperCase();
}

function tokenColor(symbol: string | undefined): string {
  if (!symbol) return "bg-neutral-400";
  const s = symbol.toLowerCase();
  if (s.includes("usdc")) return "bg-blue-500";
  if (s.includes("usdt")) return "bg-green-600";
  if (s.includes("dai")) return "bg-amber-500";
  if (s.includes("btc")) return "bg-orange-500";
  if (s.includes("eth")) return "bg-indigo-500";
  if (s.includes("eur")) return "bg-blue-700";
  return "bg-neutral-500";
}

export function VaultDetailSheet({ vault, open, onClose }: VaultDetailProps) {
  const [simInputOpen, setSimInputOpen] = useState(false);
  const [simResultsOpen, setSimResultsOpen] = useState(false);
  const [simAmount, setSimAmount] = useState(500);
  const [simIsMonthly, setSimIsMonthly] = useState(true);
  const [investOpen, setInvestOpen] = useState(false);

  if (!open) return null;

  const canInvestFromKudi =
    vault.isTransactional === true && vault.chainId === KUDI_CHAIN.chainId;

  const symbol = vault.underlyingTokens?.[0]?.symbol;
  const protocol = protocolDisplayName(vault.protocol?.name);
  const apy = vault.analytics?.apy?.total;
  const tvl = formatTvl(vault.analytics?.tvl?.usd);
  const logoPath = tokenLogoPath(symbol);
  const protocolUrl = vault.protocol?.url;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal
      aria-labelledby="vault-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85dvh] w-full max-w-[min(100%,var(--app-max-width))] flex-col overflow-y-auto rounded-t-3xl border border-border border-b-0 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-xl">
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden />

        <div className="mt-4 flex items-start justify-between gap-4">
          <p className="text-xs text-muted">
            Last sync: {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted active:bg-neutral-100"
            aria-label="Close"
          >
            <X className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="relative flex size-14 shrink-0 items-center justify-center">
            {logoPath ? (
              <Image
                src={logoPath}
                alt={symbol || ""}
                width={56}
                height={56}
                className="size-14 rounded-full"
              />
            ) : (
              <div
                className={`flex size-14 items-center justify-center rounded-full text-xl font-semibold text-white shadow-sm ${tokenColor(symbol)}`}
              >
                {tokenInitial(symbol)}
              </div>
            )}
            <Image
              src="/chain/base.jpeg"
              alt="Base"
              width={20}
              height={20}
              className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full border-2 border-white shadow-sm"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h2 id="vault-detail-title" className="text-xl font-bold leading-snug text-foreground">
              {vault.name || `${symbol} Pool`}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {symbol || "Unknown"} on {KUDI_CHAIN.name}
            </p>
          </div>

          {protocolUrl ? (
            <a
              href={protocolUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 max-w-[48%] shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold leading-snug text-primary active:bg-primary-muted/50"
              aria-label={`Open ${protocol} in a new tab`}
            >
              <span className="min-w-0 truncate">
                Open on {protocol}
              </span>
              <ExternalLink className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
            </a>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-neutral-50 px-4 py-3">
            <p className="text-xs font-medium text-muted">Current APY</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{formatApy(apy)}</p>
          </div>
          <div className="rounded-xl bg-neutral-50 px-4 py-3">
            <p className="text-xs font-medium text-muted">Total Value Locked</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{tvl}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-neutral-50 px-4 py-3">
            <p className="text-xs font-medium text-muted">Protocol</p>
            <p className="mt-1 flex items-center gap-2 text-base font-semibold text-foreground">
              <ProtocolLogo protocolName={vault.protocol?.name} size={22} />
              {protocol}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 px-4 py-3">
            <p className="text-xs font-medium text-muted">Network</p>
            <p className="mt-1 text-base font-semibold text-foreground">{KUDI_CHAIN.name}</p>
          </div>
        </div>

        {!canInvestFromKudi ? (
          <p className="mt-6 rounded-xl border border-dashed border-border bg-neutral-50 px-4 py-3 text-sm text-muted">
            This pool can&apos;t be funded from Kudi yet. Use{" "}
            {protocolUrl ? (
              <span className="font-medium text-foreground">Open on {protocol}</span>
            ) : (
              "the protocol site"
            )}{" "}
            if you want to deposit there directly.
          </p>
        ) : null}

        {canInvestFromKudi ? (
          <button
            type="button"
            onClick={() => setInvestOpen(true)}
            className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm active:scale-[0.98] active:bg-primary-hover ${
              protocolUrl ? "mt-3" : "mt-6"
            }`}
            aria-label="Earn now — add to this pool"
          >
            Earn Now
            <TrendingUp className="size-5 shrink-0" strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setSimInputOpen(true)}
          className="mt-3 flex min-h-14 items-center justify-center rounded-xl border-2 border-primary bg-primary-muted/30 px-4 text-base font-semibold text-primary active:bg-primary-muted/50"
        >
          See what you could earn
        </button>
      </div>

      <SimulationInputModal
        open={simInputOpen}
        onClose={() => setSimInputOpen(false)}
        currentAmount={simAmount}
        currentIsMonthly={simIsMonthly}
        onSimulate={(amt, monthly) => {
          setSimAmount(amt);
          setSimIsMonthly(monthly);
          setSimResultsOpen(true);
        }}
      />

      <SimulationResults
        open={simResultsOpen}
        onClose={() => setSimResultsOpen(false)}
        onEdit={() => {
          setSimResultsOpen(false);
          setSimInputOpen(true);
        }}
        apy={apy ?? 0}
        amount={simAmount}
        isMonthly={simIsMonthly}
        vaultName={vault.name}
      />

      <VaultInvestModal
        open={investOpen}
        onClose={() => setInvestOpen(false)}
        vaultAddress={vault.address}
        poolName={vault.name || `${symbol || "Pool"} · ${protocol}`}
        protocolName={vault.protocol?.name}
        vaultSlug={vault.slug}
        apyTotal={apy != null && Number.isFinite(apy) ? apy : undefined}
      />
    </div>
  );
}
