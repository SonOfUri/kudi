"use client";

import { useState } from "react";

import { AddFundsSheet } from "@/components/add-funds-sheet";

export function ProfileAddMoneyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground active:bg-primary-hover sm:w-auto"
      >
        Add money
      </button>
      <AddFundsSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
