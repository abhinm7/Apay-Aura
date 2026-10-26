"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/client";
import PinSheet from "./PinSheet";
import { EyeIcon, EyeOffIcon } from "./icons";

export default function BalanceCard({ hasPin: initialHasPin }: { hasPin: boolean }) {
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [balance, setBalance] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);

  async function reveal(pin: string) {
    try {
      if (!hasPin) {
        await api("/api/pin", { pin });
        setHasPin(true);
      }
      const res = await api<{ balance: number }>("/api/balance", { pin });
      setBalance(res.balance);
      setAsking(false);
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }

  const shown = balance !== null;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-accent p-5 text-on-accent">
      <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

      <p className="text-sm text-white/75">Aura balance</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-4xl font-semibold tracking-tight tabular-nums" aria-live="polite">
          <span className="mr-1.5 text-3xl text-white/80">✦</span>
          {shown ? balance.toLocaleString() : "••••"}
        </p>
        <button
          type="button"
          onClick={() => (shown ? setBalance(null) : setAsking(true))}
          aria-label={shown ? "Hide balance" : "Show balance"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      <p className="mt-3 text-xs text-white/70">
        {shown ? "Tap the eye to hide" : hasPin ? "Tap the eye and enter your Aura PIN" : "Create an Aura PIN to see your balance"}
      </p>

      <PinSheet
        open={asking}
        mode={hasPin ? "enter" : "create"}
        title="Enter Aura PIN"
        subtitle="To check your aura balance"
        onClose={() => setAsking(false)}
        onSubmit={reveal}
      />
    </section>
  );
}
