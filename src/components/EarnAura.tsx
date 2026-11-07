"use client";

import { ChevronRight, Swords } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Bet } from "@/lib/bet";
import type { Friend } from "@/lib/queries";
import Avatar from "./Avatar";
import ChallengeSheet from "./ChallengeSheet";
import Sheet from "./Sheet";
import VerifiedName from "./VerifiedName";

const aura = (n: number) => `✦ ${n.toLocaleString("en-IN")}`;

export function betStatusLine(bet: Bet) {
  const first = bet.other.name.split(" ")[0];
  if (bet.status === "pending") return bet.byMe ? `Waiting for ${first}` : `${first} challenged you`;
  if (bet.status === "active") return bet.myTurn ? `Your turn · ${bet.myWins}–${bet.theirWins}` : `${first}'s turn · ${bet.myWins}–${bet.theirWins}`;
  if (bet.status === "finished") return bet.result === "won" ? "You won" : bet.result === "lost" ? `${first} won` : "Tie · bets returned";
  return bet.status === "declined" ? `${bet.byMe ? first : "You"} declined` : `${bet.byMe ? "You" : first} cancelled`;
}

// Home button: pick a friend to challenge, or jump back into an open game.
export default function EarnAura({ friends, hasPin }: { friends: Friend[]; hasPin: boolean }) {
  const [open, setOpen] = useState(false);
  const [bets, setBets] = useState<Bet[] | null>(null);
  const [target, setTarget] = useState<Friend | null>(null);

  function show() {
    setOpen(true);
    fetch("/api/bets")
      .then((r) => (r.ok ? r.json() : { bets: [] }))
      .then((d) => setBets(d.bets))
      .catch(() => setBets([]));
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left active:opacity-80"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent">
          <Swords size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Earn aura</span>
          <span className="block truncate text-xs text-muted">Challenge a friend to tic-tac-toe, winner takes all</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-5">
          <div className="text-center">
            <h2 className="text-lg font-semibold">Earn aura</h2>
            <p className="text-sm text-muted">Bet aura on best-of-3 tic-tac-toe</p>
          </div>

          {bets && bets.length > 0 && (
            <section>
              <h3 className="mb-2 px-1 text-xs font-medium text-muted">Your games</h3>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {bets.map((b) => (
                  <li key={b.id}>
                    <Link href={`/bet/${b.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-line">
                      <Avatar name={b.other.name} seed={b.other.handle} src={b.other.avatarUrl} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">
                          vs {b.other.name.split(" ")[0]} · {aura(b.stake)}
                        </span>
                        <span
                          className={`block truncate text-xs ${
                            (b.status === "active" && b.myTurn) || (b.status === "pending" && !b.byMe) ? "text-accent" : "text-muted"
                          }`}
                        >
                          {betStatusLine(b)}
                        </span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 px-1 text-xs font-medium text-muted">Challenge a friend</h3>
            {friends.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                Add a friend first, then challenge them here.
              </p>
            ) : (
              <ul className="no-scrollbar max-h-72 divide-y divide-line overflow-y-auto rounded-2xl border border-line">
                {friends.map((f) => (
                  <li key={f.handle}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setTarget(f);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-line"
                    >
                      <Avatar name={f.name} seed={f.handle} src={f.avatarUrl} size={40} />
                      <VerifiedName name={f.name} verified={f.verified} className="flex-1 text-[15px] font-medium" />
                      <Swords size={18} className="shrink-0 text-accent" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Sheet>

      <ChallengeSheet key={target?.handle ?? "none"} friend={target} hasPin={hasPin} onClose={() => setTarget(null)} />
    </>
  );
}
