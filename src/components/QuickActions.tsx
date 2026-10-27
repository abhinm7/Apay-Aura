"use client";

import Link from "next/link";
import { useState } from "react";
import ReceiveSheet from "./ReceiveSheet";
import ScanSheet from "./ScanSheet";
import Sheet from "./Sheet";
import { HistoryIcon, LoanIcon, QrIcon, ScanIcon } from "./icons";

type Open = "scan" | "receive" | "loan" | null;

const tile = "flex flex-col items-center gap-2 text-xs text-ink active:opacity-70";
const bubble = "flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent";

export default function QuickActions({ name, handle, verified }: { name: string; handle: string; verified: boolean }) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  return (
    <section className="grid grid-cols-4">
      <button type="button" onClick={() => setOpen("scan")} className={tile}>
        <span className={bubble}>
          <ScanIcon />
        </span>
        Scan
      </button>
      <button type="button" onClick={() => setOpen("receive")} className={tile}>
        <span className={bubble}>
          <QrIcon />
        </span>
        Receive
      </button>
      <Link href="/history" className={tile}>
        <span className={bubble}>
          <HistoryIcon />
        </span>
        History
      </Link>
      <button type="button" onClick={() => setOpen("loan")} className={tile}>
        <span className={bubble}>
          <LoanIcon />
        </span>
        Aura Loan
      </button>

      <ScanSheet open={open === "scan"} onClose={close} myHandle={handle} />
      <ReceiveSheet open={open === "receive"} onClose={close} name={name} handle={handle} verified={verified} />
      <Sheet open={open === "loan"} onClose={close}>
        <div className="pb-2 text-center">
          <span className={`${bubble} mx-auto`}>
            <LoanIcon />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Aura Loan is coming soon</h2>
          <p className="mx-auto mt-1 max-w-64 text-sm text-muted">
            Borrow aura from apay when you&apos;re running low. We&apos;ll let you know when it&apos;s ready.
          </p>
          <button
            type="button"
            onClick={close}
            className="mt-6 h-12 w-full rounded-2xl bg-accent text-[15px] font-semibold text-on-accent active:opacity-90"
          >
            Got it
          </button>
        </div>
      </Sheet>
    </section>
  );
}
