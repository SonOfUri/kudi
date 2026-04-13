"use client";

import { Star } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { KUDI_CHAIN } from "@/lib/kudi-chain";
import { ProtocolLogo } from "@/components/protocol-logo";
import { VaultDetailSheet } from "@/components/vault-detail-sheet";
import { VaultListSkeleton } from "@/components/vault-card-skeleton";
import { FiltersModal, type SortOption } from "@/components/filters-modal";

type EarnVault = {
  address: string;
  chainId: number;
  slug?: string;
  name?: string;
  isTransactional?: boolean;
  tags?: string[];
  protocol?: { name?: string; url?: string };
  underlyingTokens?: Array<{ symbol?: string; address?: string; decimals?: number }>;
  analytics?: {
    apy?: { total?: number };
    tvl?: { usd?: string };
  };
};

type VaultsPayload = {
  data?: EarnVault[];
  nextCursor?: string;
  total?: number;
  error?: string;
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

type FilterTab = "all" | "starred" | "stablecoins";

const STARRED_STORAGE_KEY = "kudi:starred-vaults";

function loadStarredFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STARRED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveStarredToStorage(starred: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify(Array.from(starred)));
  } catch {
    // Ignore storage errors
  }
}

export function MarketsYieldList() {
  const [vaults, setVaults] = useState<EarnVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [starred, setStarred] = useState<Set<string>>(() => loadStarredFromStorage());
  const [activeFilter, setActiveFilter] = useState<FilterTab>("stablecoins");
  const [selectedVault, setSelectedVault] = useState<EarnVault | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("apy-high");
  const [tokenFilters, setTokenFilters] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (cursor?: string) => {
    const isInitial = !cursor;
    if (isInitial) {
      setLoading(true);
      setVaults([]);
      setNextCursor(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }
    setFetchError(null);

    try {
      const params = new URLSearchParams();
      if (cursor) {
        params.set("cursor", cursor);
      }
      const url = params.toString() ? `/api/lifi/vaults?${params}` : "/api/lifi/vaults";
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as VaultsPayload;
      if (!res.ok) {
        throw new Error(json.error || "Could not load vaults");
      }
      const rows = json.data ?? [];
      const depositable = rows.filter(
        (v) => v.isTransactional === true && v.chainId === KUDI_CHAIN.chainId,
      );

      setVaults((prev) => {
        if (isInitial) return depositable;
        const map = new Map<string, EarnVault>();
        for (const v of prev) {
          map.set(`${v.chainId}-${v.address}`, v);
        }
        for (const v of depositable) {
          map.set(`${v.chainId}-${v.address}`, v);
        }
        return Array.from(map.values());
      });
      setNextCursor(json.nextCursor ?? null);
      setHasMore(!!json.nextCursor);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Could not load vaults");
      if (isInitial) {
        setVaults([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !nextCursor) return;
    void load(nextCursor);
  }, [loadingMore, hasMore, nextCursor, load]);

  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const threshold = 300;

      if (scrollHeight - (scrollTop + clientHeight) < threshold) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingMore, loadMore]);

  const toggleStar = useCallback((address: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      saveStarredToStorage(next);
      return next;
    });
  }, []);

  const applyFiltersAndSort = useCallback(
    (sort: SortOption, tokens: Set<string>) => {
      setSortOption(sort);
      setTokenFilters(tokens);
    },
    [],
  );

  const availableTokens = useMemo(() => {
    const tokens = new Set<string>();
    for (const vault of vaults) {
      const symbol = vault.underlyingTokens?.[0]?.symbol?.toUpperCase();
      if (symbol) {
        tokens.add(symbol);
      }
    }
    return Array.from(tokens).sort();
  }, [vaults]);

  const filtered = vaults.filter((v) => {
    if (activeFilter === "starred") return starred.has(v.address);
    if (activeFilter === "stablecoins") {
      const isStable = v.tags?.some((t) => t === "stablecoin") ?? false;
      if (!isStable) return false;
    }

    if (tokenFilters.size > 0) {
      const symbol = v.underlyingTokens?.[0]?.symbol?.toUpperCase();
      if (!symbol) return false;
      const matchesToken = tokenFilters.has(symbol) || tokenFilters.has(symbol.replace(/^W/, ""));
      if (!matchesToken) return false;
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const apyA = a.analytics?.apy?.total ?? 0;
    const apyB = b.analytics?.apy?.total ?? 0;
    const tvlA = Number(a.analytics?.tvl?.usd ?? 0);
    const tvlB = Number(b.analytics?.tvl?.usd ?? 0);
    const nameA = (a.underlyingTokens?.[0]?.symbol || a.name || "").toLowerCase();
    const nameB = (b.underlyingTokens?.[0]?.symbol || b.name || "").toLowerCase();

    switch (sortOption) {
      case "apy-high":
        return apyB - apyA;
      case "apy-low":
        return apyA - apyB;
      case "tvl-high":
        return tvlB - tvlA;
      case "tvl-low":
        return tvlA - tvlB;
      case "name-az":
        return nameA.localeCompare(nameB);
      case "name-za":
        return nameB.localeCompare(nameA);
      default:
        return apyB - apyA;
    }
  });

  if (loading) {
    return <VaultListSkeleton count={8} />;
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
        <p className="font-medium">Could not load yield data</p>
        <p className="mt-1 text-destructive/90">{fetchError}</p>
        <p className="mt-3 text-xs text-muted">
          Check <code className="rounded bg-muted px-1">LIFI_API_KEY</code> in{" "}
          <code className="rounded bg-muted px-1">.env</code>.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveFilter("starred")}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
            activeFilter === "starred"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-neutral-100 text-muted hover:bg-neutral-200"
          }`}
        >
          <Star className="size-4" strokeWidth={2} aria-hidden />
          Starred
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("stablecoins")}
          className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
            activeFilter === "stablecoins"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-neutral-100 text-muted hover:bg-neutral-200"
          }`}
        >
          Stablecoins
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
            activeFilter === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-neutral-100 text-muted hover:bg-neutral-200"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="ml-auto shrink-0 rounded-xl bg-neutral-100 px-3 py-2 text-sm font-medium text-muted hover:bg-neutral-200"
        >
          More Filters ({vaults.length})
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-elevated px-4 py-6 text-center text-sm text-muted">
          No pools match this filter.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((v) => {
            const symbol = v.underlyingTokens?.[0]?.symbol;
            const protocol = protocolDisplayName(v.protocol?.name);
            const apy = v.analytics?.apy?.total;
            const tvl = formatTvl(v.analytics?.tvl?.usd);
            const isStarred = starred.has(v.address);
            const logoPath = tokenLogoPath(symbol);

            return (
              <li key={`${v.chainId}-${v.address}`}>
                <div
                  onClick={() => setSelectedVault(v)}
                  className="flex w-full cursor-pointer items-center gap-3  bg-white px-4 py-3 text-left transition-shadow active:scale-[0.99]"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedVault(v);
                    }
                  }}
                >
                <div className="relative flex size-10 shrink-0 items-center justify-center">
                  {logoPath ? (
                    <Image
                      src={logoPath}
                      alt={symbol || ""}
                      width={40}
                      height={40}
                      className="size-10 rounded-full"
                    />
                  ) : (
                    <div
                      className={`flex size-10 items-center justify-center rounded-full text-base font-semibold text-white shadow-sm ${tokenColor(symbol)}`}
                    >
                      {tokenInitial(symbol)}
                    </div>
                  )}
                  <Image
                    src="/chain/base.jpeg"
                    alt="Base"
                    width={16}
                    height={16}
                    className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full border border-white shadow-sm"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold leading-snug text-foreground">
                    {symbol || v.name || "Unknown"}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <ProtocolLogo protocolName={v.protocol?.name} size={14} />
                    {protocol}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xl font-bold leading-snug text-green-600">
                    {formatApy(apy)}
                  </p>
                  <p className="text-xs text-muted">{tvl}</p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStar(v.address);
                  }}
                  className="ml-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors active:bg-neutral-100"
                  aria-label={isStarred ? "Unstar" : "Star"}
                >
                  <Star
                    className="size-5"
                    strokeWidth={2}
                    fill={isStarred ? "currentColor" : "none"}
                    aria-hidden
                  />
                </button>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      {loadingMore ? (
        <div className="mt-4 flex justify-center">
          <div className="flex items-center gap-2 rounded-xl bg-neutral-100 px-4 py-3">
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted">Loading more...</p>
          </div>
        </div>
      ) : null}

      {!loading && !hasMore && sorted.length > 0 ? (
        <p className="mt-4 text-center text-sm text-muted">No more pools to load</p>
      ) : null}

      {selectedVault ? (
        <VaultDetailSheet
          vault={selectedVault}
          open={selectedVault != null}
          onClose={() => setSelectedVault(null)}
        />
      ) : null}

      <FiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        currentSort={sortOption}
        currentTokens={tokenFilters}
        availableTokens={availableTokens}
        onApply={applyFiltersAndSort}
      />
    </div>
  );
}
