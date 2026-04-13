"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { MobileSheetNotch } from "@/components/mobile-bottom-sheet";

export type SortOption =
  | "apy-high"
  | "apy-low"
  | "tvl-high"
  | "tvl-low"
  | "name-az"
  | "name-za";

type FiltersModalProps = {
  open: boolean;
  onClose: () => void;
  currentSort: SortOption;
  currentTokens: Set<string>;
  availableTokens: string[];
  onApply: (sort: SortOption, tokens: Set<string>) => void;
};

const SORT_OPTIONS: Array<{ id: SortOption; label: string }> = [
  { id: "apy-high", label: "APY (High to Low)" },
  { id: "apy-low", label: "APY (Low to High)" },
  { id: "tvl-high", label: "TVL (High to Low)" },
  { id: "tvl-low", label: "TVL (Low to High)" },
  { id: "name-az", label: "Name (A-Z)" },
  { id: "name-za", label: "Name (Z-A)" },
];

export function FiltersModal({
  open,
  onClose,
  currentSort,
  currentTokens,
  availableTokens,
  onApply,
}: FiltersModalProps) {
  const [sort, setSort] = useState<SortOption>(currentSort);
  const [tokens, setTokens] = useState<Set<string>>(new Set(currentTokens));

  if (!open) return null;

  const toggleToken = (token: string) => {
    const next = new Set(tokens);
    if (next.has(token)) {
      next.delete(token);
    } else {
      next.add(token);
    }
    setTokens(next);
  };

  const clearAll = () => {
    setSort("apy-high");
    setTokens(new Set());
  };

  const apply = () => {
    onApply(sort, tokens);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal
      aria-labelledby="filters-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85dvh] w-full max-w-[min(100%,var(--app-max-width))] flex-col overflow-y-auto rounded-t-3xl border border-border border-b-0 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-0 shadow-xl">
        <div className="flex justify-center pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
          <MobileSheetNotch />
        </div>

        <div className="mt-4 flex items-start justify-between gap-4">
          <h2 id="filters-title" className="text-xl font-bold leading-snug text-foreground">
            Filters & Sorting
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted active:bg-neutral-100"
            aria-label="Close"
          >
            <X className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <div className="mt-6">
          <h3 className="text-base font-bold text-foreground">Sort By</h3>
          <div className="mt-3 space-y-1">
            {SORT_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 active:bg-neutral-50"
              >
                <input
                  type="radio"
                  name="sort"
                  checked={sort === opt.id}
                  onChange={() => setSort(opt.id)}
                  className="size-5 shrink-0 accent-primary"
                />
                <span className="text-base text-foreground">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-base font-bold text-foreground">Tokens</h3>
          {availableTokens.length === 0 ? (
            <p className="mt-3 px-3 py-2 text-sm text-muted">No tokens available</p>
          ) : (
            <div className="mt-3 space-y-1">
              {availableTokens.map((token) => (
                <label
                  key={token}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 active:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={tokens.has(token)}
                    onChange={() => toggleToken(token)}
                    className="size-5 shrink-0 rounded accent-primary"
                  />
                  <span className="text-base text-foreground">{token}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={clearAll}
            className="min-h-14 flex-1 rounded-xl border border-border bg-white px-4 text-base font-semibold text-foreground active:bg-neutral-50"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={apply}
            className="min-h-14 flex-1 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm active:scale-[0.98]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
