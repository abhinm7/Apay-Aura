"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { MAX_STAKE, MIN_STAKE, ROUNDS, TURN_SECONDS, validateStake } from "@/lib/bet";
import type { Friend } from "@/lib/queries";
import { FormError } from "./AuthShell";
import Avatar from "./Avatar";
import PinSheet from "./PinSheet";
import Sheet from "./Sheet";
import VerifiedName from "./VerifiedName";

const QUICK = [100, 500, 1000, 5000];
const aura = (n: number) => `✦ ${n.toLocaleString("en-IN")}`;

// Pick a stake, confirm with the PIN, then go to the game. Used from home and chat.
export default function ChallengeSheet({
  friend,
  hasPin: initialHasPin,
  initialStake,
  onClose,
}: {
  friend: Friend | null;
  hasPin: boolean;
  initialStake?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [stake, setStake] = useState(initialStake ? String(initialStake) : "");
  const [error, setError] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [hasPin, setHasPin] = useState(initialHasPin);

  if (!friend) return null;
  const first = friend.name.split(" ")[0];
  const amount = Number(stake);
  const invalid = stake ? validateStake(amount) : "Enter your bet";

  async function challenge(pin: string) {
    if (!friend) return null;
    try {
      if (!hasPin) {
        await api("/api/pin", { pin });
        setHasPin(true);
      }
      const res = await api<{ id: string }>("/api/bets", { to: friend.handle, stake: amount, pin });
      router.push(`/bet/${res.id}`);
      return null;
    } catch (e) {
      const msg = errorMessage(e);
      if (/PIN|attempt/i.test(msg)) return msg;
      setPinOpen(false);
      setError(msg);
      return null;
    }
  }

  return (
    <>
      <Sheet open={!pinOpen} onClose={onClose}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return setError(invalid);
            setError(null);
            setPinOpen(true);
          }}
          className="flex flex-col items-center text-center"
        >
          <Avatar name={friend.name} seed={friend.handle} src={friend.avatarUrl} size={56} />
          <p className="mt-2 text-sm text-muted">Challenge</p>
          <VerifiedName name={friend.name} verified={friend.verified} className="max-w-full text-base font-semibold" />
          <p className="text-xs text-muted">Tic-tac-toe · best of {ROUNDS}</p>

          <label className="mt-6 flex items-center justify-center gap-1.5">
            <span className="text-3xl text-accent">✦</span>
            <input
              value={stake}
              onChange={(e) => setStake(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="0"
              autoFocus
              aria-label="Your bet"
              className="w-40 bg-transparent text-center text-4xl font-semibold tabular-nums outline-none placeholder:text-muted"
            />
          </label>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setStake(String(q))}
                className={`rounded-full border px-3 py-1 text-sm font-medium tabular-nums ${
                  amount === q ? "border-accent bg-accent-soft text-accent" : "border-line"
                }`}
              >
                {aura(q)}
              </button>
            ))}
          </div>

          <ul className="mt-5 w-full space-y-1.5 rounded-2xl bg-bg px-4 py-3 text-left text-sm text-muted">
            <li>
              You both put in <strong className="text-ink">{amount ? aura(amount) : "your bet"}</strong>. Winner takes{" "}
              <strong className="text-ink">{amount ? aura(amount * 2) : "both"}</strong>.
            </li>
            <li>First to win 2 of {ROUNDS} rounds wins. Still tied after {ROUNDS} rounds? Both get their bet back.</li>
            <li>{TURN_SECONDS} seconds per move, or you lose the round.</li>
            <li>If {first} declines, your aura comes back.</li>
          </ul>

          <div className="mt-4 w-full">
            <FormError message={error} />
          </div>
          <button
            type="submit"
            disabled={Boolean(invalid)}
            className="mt-3 h-12 w-full rounded-2xl bg-accent text-[15px] font-semibold text-on-accent active:opacity-90 disabled:opacity-40"
          >
            {invalid ? "Challenge" : `Challenge · Bet ${aura(amount)}`}
          </button>
          <p className="mt-2 text-xs text-muted">
            {aura(MIN_STAKE)} – {aura(MAX_STAKE)}
          </p>
        </form>
      </Sheet>

      <PinSheet
        open={pinOpen}
        mode={hasPin ? "enter" : "create"}
        title="Enter Aura PIN"
        subtitle={`Betting ${aura(amount)} against ${friend.name}`}
        onClose={() => setPinOpen(false)}
        onSubmit={challenge}
      />
    </>
  );
}
