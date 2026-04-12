"use client";

import { useState } from "react";

import { AddFundsSheet } from "@/components/add-funds-sheet";

export function MarketsAddFundsCta() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-center rounded-xl border border-primary/30 bg-primary-muted/60 px-4 text-sm font-semibold text-primary active:bg-primary-muted"
      >
        Add USDT / USDC to wallet
      </button>
      <AddFundsSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
