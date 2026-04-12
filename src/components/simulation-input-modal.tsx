"use client";

import { X } from "lucide-react";
import { useState } from "react";

type SimulationInputModalProps = {
  open: boolean;
  onClose: () => void;
  onSimulate: (amount: number, isMonthly: boolean) => void;
  currentAmount?: number;
  currentIsMonthly?: boolean;
};

export function SimulationInputModal({
  open,
  onClose,
  onSimulate,
  currentAmount = 500,
  currentIsMonthly = true,
}: SimulationInputModalProps) {
  const [amount, setAmount] = useState(String(currentAmount));
  const [isMonthly, setIsMonthly] = useState(currentIsMonthly);

  if (!open) return null;

  const handleDigit = (digit: string) => {
    if (amount === "0") {
      setAmount(digit);
    } else if (amount.length < 10) {
      setAmount(amount + digit);
    }
  };

  const handleDecimal = () => {
    if (!amount.includes(".")) {
      setAmount(amount + ".");
    }
  };

  const handleBackspace = () => {
    if (amount.length > 1) {
      setAmount(amount.slice(0, -1));
    } else {
      setAmount("0");
    }
  };

  const handleSimulate = () => {
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    onSimulate(parsed, isMonthly);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      role="dialog"
      aria-modal
      aria-labelledby="sim-input-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85dvh] w-full max-w-[min(100%,var(--app-max-width))] flex-col rounded-t-3xl border border-border border-b-0 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="sim-input-title" className="text-lg font-semibold text-foreground">
            Add Money
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-foreground active:bg-neutral-200"
            aria-label="Close"
          >
            <X className="size-5 shrink-0" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-6xl font-bold tabular-nums tracking-tight text-foreground">
            ${amount}
          </p>
        </div>

        <div className="mt-8 flex gap-2 rounded-2xl bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => setIsMonthly(false)}
            className={`flex-1 rounded-xl px-4 py-3 text-base font-semibold transition-colors ${
              !isMonthly
                ? "bg-white text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            One-Off
          </button>
          <button
            type="button"
            onClick={() => setIsMonthly(true)}
            className={`flex-1 rounded-xl px-4 py-3 text-base font-semibold transition-colors ${
              isMonthly
                ? "bg-white text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            Monthly
          </button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "←"].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === "←") handleBackspace();
                else if (key === ".") handleDecimal();
                else handleDigit(key);
              }}
              className="flex h-16 items-center justify-center rounded-xl text-2xl font-semibold text-foreground active:bg-neutral-100"
            >
              {key === "←" ? "⌫" : key}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSimulate}
          disabled={!amount || parseFloat(amount) <= 0}
          className="mt-6 min-h-14 rounded-2xl bg-primary px-4 text-lg font-bold text-primary-foreground shadow-sm disabled:opacity-50 active:scale-[0.98]"
        >
          Simulate
        </button>
      </div>
    </div>
  );
}
