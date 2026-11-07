"use client";

import { Swords } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FormError, PrimaryButton } from "@/components/AuthShell";
import Avatar from "@/components/Avatar";
import ChallengeSheet from "@/components/ChallengeSheet";
import PinSheet from "@/components/PinSheet";
import Sheet from "@/components/Sheet";
import VerifiedName from "@/components/VerifiedName";
import { BackIcon } from "@/components/icons";
import { ApiError, api, errorMessage } from "@/lib/client";
import { ROUNDS, TURN_SECONDS, winningLine, type Bet } from "@/lib/bet";
import type { Friend } from "@/lib/queries";

const POLL_MS = 1500;
const aura = (n: number) => `✦ ${n.toLocaleString("en-IN")}`;

// Current time, ticking every second. Null until mounted, so server and client render the same.
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function BetView({ initial, me, hasPin: initialHasPin }: { initial: Bet; me: Friend; hasPin: boolean }) {
  const [bet, setBet] = useState(initial);
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [rematch, setRematch] = useState(false);
  // Shown for a moment when a round ends: that round's board and result.
  const [roundEnd, setRoundEnd] = useState<{ round: number; board: string; result: Bet["lastResult"] } | null>(null);
  const now = useNow();
  const other = bet.other;
  const first = other.name.split(" ")[0];
  const live = bet.status === "pending" || bet.status === "active";

  // A new bet state from the server: notice finished rounds before taking it.
  const prev = useRef(bet);
  function take(next: Bet) {
    const before = prev.current;
    if (next.status === "active" && next.round > before.round && next.lastBoard) {
      setRoundEnd({ round: before.round, board: next.lastBoard, result: next.lastResult });
      setTimeout(() => setRoundEnd(null), 2200);
    }
    prev.current = next;
    setBet(next);
  }

  useEffect(() => {
    if (!live) return;
    const poll = setInterval(async () => {
      if (document.hidden) return;
      try {
        take((await api<{ bet: Bet }>(`/api/bets/${bet.id}`)).bet);
      } catch {
        // Try again on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [live, bet.id]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      take((await api<{ bet: Bet }>(`/api/bets/${bet.id}`, body)).bet);
      return null;
    } catch (e) {
      if (e instanceof ApiError && e.data.bet) take(e.data.bet as Bet);
      return errorMessage(e);
    } finally {
      setBusy(false);
    }
  }

  function move(cell: number) {
    if (!bet.myTurn || bet.board[cell] !== "." || busy) return;
    // Show the mark straight away; the server's answer replaces it.
    setBet((b) => ({ ...b, board: b.board.slice(0, cell) + b.myMark + b.board.slice(cell + 1), myTurn: false }));
    act({ action: "move", cell }).then((err) => err && setError(err));
  }

  async function accept(pin: string) {
    try {
      if (!hasPin) {
        await api("/api/pin", { pin });
        setHasPin(true);
      }
    } catch (e) {
      return errorMessage(e);
    }
    const err = await act({ action: "accept", pin });
    if (err && /PIN|attempt/i.test(err)) return err;
    setPinOpen(false);
    if (err) setError(err);
    return null;
  }

  const left =
    bet.status === "active" && bet.turnDeadline && now !== null
      ? Math.max(0, Math.ceil((new Date(bet.turnDeadline).getTime() - now) / 1000))
      : TURN_SECONDS;

  return (
    <main className="flex min-h-dvh flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <Link
          href={`/chat/${other.handle}`}
          aria-label="Back to chat"
          className="flex h-10 w-10 items-center justify-center rounded-full active:bg-line"
        >
          <BackIcon />
        </Link>
        <h1 className="text-[17px] font-semibold">Aura bet</h1>
        <span className="ml-auto mr-2 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent tabular-nums">
          Pot {aura(bet.stake * 2)}
        </span>
      </header>

      {/* Scoreboard */}
      <section className="mx-4 mt-4 flex items-center justify-between rounded-2xl bg-surface px-4 py-4">
        <Player person={me} mark={bet.myMark} active={bet.status === "active" && bet.myTurn} label="You" />
        <div className="text-center">
          <p className="text-3xl font-semibold tabular-nums">
            {bet.myWins} <span className="text-muted">–</span> {bet.theirWins}
          </p>
          <p className="text-xs text-muted">
            {bet.status === "active" ? `Round ${bet.round} of ${ROUNDS}` : `Best of ${ROUNDS}`}
          </p>
        </div>
        <Player
          person={other}
          mark={bet.myMark === "X" ? "O" : "X"}
          active={bet.status === "active" && !bet.myTurn}
          label={first}
        />
      </section>

      <div className="flex flex-1 flex-col px-4 pt-5">
        {bet.status === "pending" && (
          <div className="flex flex-col items-center pt-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Swords size={30} />
            </span>
            {bet.byMe ? (
              <>
                <h2 className="mt-4 text-lg font-semibold">Waiting for {first} to accept</h2>
                <p className="mt-1 max-w-64 text-sm text-muted">
                  Your {aura(bet.stake)} is held until they answer. If they decline, it comes back.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act({ action: "cancel" }).then((err) => err && setError(err))}
                  className="mt-8 h-11 rounded-2xl px-6 text-sm font-semibold text-danger active:bg-line disabled:opacity-50"
                >
                  Cancel challenge
                </button>
              </>
            ) : (
              <>
                <h2 className="mt-4 text-lg font-semibold">{first} challenged you</h2>
                <p className="mt-1 max-w-64 text-sm text-muted">
                  Put in {aura(bet.stake)} to play best-of-{ROUNDS} tic-tac-toe. Winner takes {aura(bet.stake * 2)}.
                </p>
                <div className="mt-8 flex w-full flex-col gap-2">
                  <PrimaryButton type="button" disabled={busy} onClick={() => setPinOpen(true)}>
                    Accept · Bet {aura(bet.stake)}
                  </PrimaryButton>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act({ action: "decline" }).then((err) => err && setError(err))}
                    className="h-11 rounded-2xl text-sm font-semibold text-danger active:bg-line disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {bet.status === "active" && (
          <>
            <p className={`text-center text-[15px] font-semibold ${bet.myTurn ? "text-accent" : "text-muted"}`}>
              {bet.myTurn ? "Your turn" : `${first}'s turn`}
              <span className={`ml-2 tabular-nums ${left <= 10 ? "text-danger" : ""}`}>
                0:{String(left).padStart(2, "0")}
              </span>
            </p>
            <Board board={bet.board} canPlay={bet.myTurn && !busy} onPick={move} />
            <p className="mt-3 text-center text-xs text-muted">
              You&apos;re {bet.myMark}. {TURN_SECONDS}s per move, or you lose the round.
            </p>
            <button
              type="button"
              onClick={() => setConfirmForfeit(true)}
              className="mx-auto mt-auto h-10 rounded-2xl px-5 text-sm font-medium text-muted active:bg-line"
            >
              Give up
            </button>
          </>
        )}

        {bet.status === "finished" && (
          <div className="flex flex-col items-center text-center">
            <h2
              className={`text-2xl font-semibold ${
                bet.result === "won" ? "text-success" : bet.result === "lost" ? "text-danger" : ""
              }`}
            >
              {bet.result === "won" ? `You won ${aura(bet.stake * 2)}!` : bet.result === "lost" ? `${first} won` : "It's a tie"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {bet.forfeitedByMe === true
                ? "You gave up."
                : bet.forfeitedByMe === false
                  ? `${first} gave up.`
                  : bet.result === "tie"
                    ? `${aura(bet.stake)} went back to each of you.`
                    : bet.result === "lost"
                      ? `You lost ${aura(bet.stake)}. Better luck next time.`
                      : "The pot is in your balance."}
            </p>
            {bet.lastBoard && <Board board={bet.lastBoard} canPlay={false} />}
            <div className="mt-6 flex w-full flex-col gap-2">
              <PrimaryButton type="button" onClick={() => setRematch(true)}>
                Rematch
              </PrimaryButton>
              <Link
                href={`/chat/${other.handle}`}
                className="flex h-11 items-center justify-center rounded-2xl text-sm font-semibold text-accent active:bg-line"
              >
                Back to chat
              </Link>
            </div>
          </div>
        )}

        {(bet.status === "declined" || bet.status === "cancelled") && (
          <div className="flex flex-col items-center pt-6 text-center">
            <h2 className="text-lg font-semibold">
              {bet.status === "declined"
                ? bet.byMe
                  ? `${first} declined`
                  : "You declined"
                : bet.byMe
                  ? "You cancelled this challenge"
                  : `${first} cancelled this challenge`}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {bet.byMe ? `Your ${aura(bet.stake)} is back in your balance.` : "No aura was taken from you."}
            </p>
            <Link
              href={`/chat/${other.handle}`}
              className="mt-8 flex h-11 items-center justify-center rounded-2xl px-6 text-sm font-semibold text-accent active:bg-line"
            >
              Back to chat
            </Link>
          </div>
        )}

        <div className="mt-4">
          <FormError message={error} />
        </div>
      </div>

      {/* A round just ended */}
      {roundEnd && (
        <div className="animate-fade fixed inset-0 z-40 flex flex-col items-center justify-center bg-bg/90 px-8 text-center backdrop-blur-sm">
          <p className="text-sm text-muted">Round {roundEnd.round}</p>
          <h2 className="text-2xl font-semibold">
            {roundEnd.result === "me" ? "You won the round!" : roundEnd.result === "them" ? `${first} won the round` : "Draw"}
          </h2>
          <div className="w-full max-w-64">
            <Board board={roundEnd.board} canPlay={false} />
          </div>
        </div>
      )}

      <PinSheet
        open={pinOpen}
        mode={hasPin ? "enter" : "create"}
        title="Enter Aura PIN"
        subtitle={`Betting ${aura(bet.stake)} against ${other.name}`}
        onClose={() => setPinOpen(false)}
        onSubmit={accept}
      />

      <Sheet open={confirmForfeit} onClose={() => setConfirmForfeit(false)}>
        <div className="flex flex-col gap-4 text-center">
          <div>
            <h2 className="text-lg font-semibold">Give up?</h2>
            <p className="mt-1 text-sm text-muted">
              {first} wins the match and the {aura(bet.stake * 2)} pot.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirmForfeit(false);
              act({ action: "forfeit" }).then((err) => err && setError(err));
            }}
            className="h-12 w-full rounded-2xl bg-danger text-[15px] font-semibold text-on-accent active:opacity-90 disabled:opacity-50"
          >
            Yes, give up
          </button>
          <button
            type="button"
            onClick={() => setConfirmForfeit(false)}
            className="-mt-1 h-11 w-full rounded-2xl text-[15px] font-semibold text-accent active:bg-line"
          >
            Keep playing
          </button>
        </div>
      </Sheet>

      {rematch && (
        <ChallengeSheet friend={other} hasPin={hasPin} initialStake={bet.stake} onClose={() => setRematch(false)} />
      )}
    </main>
  );
}

function Player({ person, mark, active, label }: { person: Friend; mark: "X" | "O"; active: boolean; label: string }) {
  return (
    <div className="flex w-20 flex-col items-center gap-1">
      <span className={`rounded-full p-0.5 transition-shadow ${active ? "ring-2 ring-accent" : ""}`}>
        <Avatar name={person.name} seed={person.handle} src={person.avatarUrl} size={48} />
      </span>
      <VerifiedName name={label} verified={person.verified} badgeSize={13} className="max-w-full justify-center text-xs font-medium" />
      <Mark mark={mark} size={16} />
    </div>
  );
}

function Board({ board, canPlay, onPick }: { board: string; canPlay: boolean; onPick?: (cell: number) => void }) {
  const line = winningLine(board);
  return (
    <div className="mx-auto mt-4 grid w-full max-w-80 grid-cols-3 gap-2" role="grid" aria-label="Tic-tac-toe board">
      {[...board].map((c, i) => {
        const empty = c === ".";
        return (
          <button
            key={i}
            type="button"
            disabled={!canPlay || !empty}
            onClick={() => onPick?.(i)}
            aria-label={empty ? `Square ${i + 1}, empty` : `Square ${i + 1}, ${c}`}
            className={`flex aspect-square items-center justify-center rounded-2xl transition-colors ${
              line?.includes(i) ? "bg-accent-soft" : "bg-surface"
            } ${canPlay && empty ? "active:bg-line" : ""}`}
          >
            {!empty && <Mark key={c} mark={c as "X" | "O"} size={44} pop />}
          </button>
        );
      })}
    </div>
  );
}

function Mark({ mark, size, pop }: { mark: "X" | "O"; size: number; pop?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={pop ? "mark-pop" : undefined}>
      {mark === "X" ? (
        <path d="M6 6l12 12M18 6L6 18" className="stroke-accent" strokeWidth={3} strokeLinecap="round" fill="none" />
      ) : (
        <circle cx={12} cy={12} r={7} className="stroke-brand-light" strokeWidth={3} fill="none" />
      )}
    </svg>
  );
}
