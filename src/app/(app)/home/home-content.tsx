"use client";

import { X } from "lucide-react";
import { useState } from "react";

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal aria-labelledby="modal-title">
      <button type="button" className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[85dvh] w-full max-w-[min(100%,var(--app-max-width))] overflow-y-auto rounded-t-3xl border border-border border-b-0 bg-surface-elevated px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-xl">
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden />
        <div className="mt-4 flex items-start justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-semibold leading-snug text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted active:bg-primary-muted"
            aria-label="Close dialog"
          >
            <X className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <div className="mt-4 text-base leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function HomeContent({ email }: { email: string }) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
        <p className="text-sm text-muted">Total balance</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground tabular-nums">—</p>
        <p className="mt-1 text-xs text-muted">Yield and wallet connect here next.</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setDepositOpen(true)}
            className="min-h-12 w-full rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground active:bg-primary-hover"
          >
            Deposit
          </button>
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            className="min-h-12 w-full rounded-xl border border-border bg-surface-elevated px-5 text-base font-medium text-foreground active:bg-primary-muted"
          >
            Withdraw
          </button>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted">
        Signed in as <span className="font-medium text-foreground">{email}</span>
      </p>

      <Modal title="Deposit" open={depositOpen} onClose={() => setDepositOpen(false)}>
        <p className="text-sm text-muted">Choose amount and funding source. Wiring this to payments comes next.</p>
      </Modal>
      <Modal title="Withdraw" open={withdrawOpen} onClose={() => setWithdrawOpen(false)}>
        <p className="text-sm text-muted">Destination and limits will appear here.</p>
      </Modal>
    </>
  );
}
