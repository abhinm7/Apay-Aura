"use client";

import Link from "next/link";
import { useState } from "react";
import ReceiveSheet from "./ReceiveSheet";
import ScanSheet from "./ScanSheet";
import { HistoryIcon, LoanIcon, QrIcon, ScanIcon } from "./icons";

type Open = "scan" | "receive" | null;

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
      <Link href="/loans" className={tile}>
        <span className={bubble}>
          <LoanIcon />
        </span>
        Aura Loan
      </Link>

      <ScanSheet open={open === "scan"} onClose={close} myHandle={handle} />
      <ReceiveSheet open={open === "receive"} onClose={close} name={name} handle={handle} verified={verified} />
    </section>
  );
}
