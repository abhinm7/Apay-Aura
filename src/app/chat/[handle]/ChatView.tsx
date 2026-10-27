"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import PinSheet from "@/components/PinSheet";
import Sheet from "@/components/Sheet";
import VerifiedName from "@/components/VerifiedName";
import { BackIcon, CheckIcon, SendIcon } from "@/components/icons";
import { api, errorMessage } from "@/lib/client";
import type { Friend, Message } from "@/lib/queries";
import { auraId } from "@/lib/validate";

const POLL_MS = 3000;

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

// openPay: arrived from a scanned QR (?pay=1), so start on the pay screen.
type Props = { friend: Friend; hasPin: boolean; initialMessages: Message[]; openPay?: boolean };

export default function ChatView({ friend, hasPin: initialHasPin, initialMessages, openPay = false }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [hasPin, setHasPin] = useState(initialHasPin);

  const [payOpen, setPayOpen] = useState(openPay);
  const [pinOpen, setPinOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(initialMessages.at(-1)?.id ?? "0");

  const merge = useCallback((incoming: Message[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    lastId.current = incoming.reduce((a, m) => (Number(m.id) > Number(a) ? m.id : a), lastId.current);
  }, []);

  useEffect(() => {
    const poll = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await api<{ messages: Message[] }>(`/api/chat/${friend.handle}?after=${lastId.current}`);
        merge(res.messages);
      } catch {
        // Try again on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [friend.handle, merge]);

  // Drop ?pay=1 so a reload doesn't reopen the pay screen.
  useEffect(() => {
    if (openPay) window.history.replaceState(null, "", `/chat/${friend.handle}`);
  }, [openPay, friend.handle]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function sendText(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await api<{ message: Message }>(`/api/chat/${friend.handle}`, { text: body });
      merge([res.message]);
      setText("");
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const amountNum = Number(amount);
  const amountValid = Number.isInteger(amountNum) && amountNum > 0;

  function proceedToPin(e: React.FormEvent) {
    e.preventDefault();
    if (!amountValid) return setPayError("Enter an amount");
    setPayError(null);
    setPayOpen(false);
    setPinOpen(true);
    primeTune();
  }

  // The success tune plays after a network call, which iOS Safari treats as
  // autoplay. Starting it muted inside this tap unlocks it for later.
  const tune = useRef<HTMLAudioElement | null>(null);
  function primeTune() {
    if (!tune.current) tune.current = new Audio("/paytune.mp3");
    const a = tune.current;
    a.muted = true;
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      })
      .catch(() => {});
  }
  function playTune() {
    const a = tune.current ?? new Audio("/paytune.mp3");
    a.muted = false;
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  async function pay(pin: string) {
    try {
      if (!hasPin) {
        await api("/api/pin", { pin });
        setHasPin(true);
      }
      const res = await api<{ message: Message }>("/api/pay", { to: friend.handle, amount: amountNum, note, pin });
      merge([res.message]);
      setPinOpen(false);
      setSent(amountNum);
      playTune();
      setAmount("");
      setNote("");
      setTimeout(() => setSent(null), 1800);
      return null;
    } catch (err) {
      const msg = errorMessage(err);
      // PIN problems stay on the PIN pad; anything else goes back to the amount screen.
      if (/PIN|attempt/i.test(msg)) return msg;
      setPinOpen(false);
      setPayError(msg);
      setPayOpen(true);
      return null;
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <Link href="/" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-line">
          <BackIcon />
        </Link>
        <Avatar name={friend.name} seed={friend.handle} size={38} />
        <div className="min-w-0">
          <VerifiedName name={friend.name} verified={friend.verified} className="text-[15px] font-semibold" />
          <p className="truncate text-xs text-muted">{auraId(friend.handle)}</p>
        </div>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Avatar name={friend.name} seed={friend.handle} size={72} />
            <VerifiedName name={friend.name} verified={friend.verified} className="text-base font-semibold" />
            <p className="max-w-60 text-sm text-muted">Say hi or send some aura to start your conversation.</p>
          </div>
        )}
        <ul className="flex flex-col gap-2">
          {messages.map((m, i) => {
            const showDay = i === 0 || dayLabel(messages[i - 1].createdAt) !== dayLabel(m.createdAt);
            return (
              <li key={m.id} className="flex flex-col">
                {showDay && (
                  <span className="mx-auto my-2 rounded-full bg-surface px-3 py-1 text-xs text-muted">
                    {dayLabel(m.createdAt)}
                  </span>
                )}
                {m.kind === "payment" ? <PaymentBubble m={m} friendName={friend.name} /> : <TextBubble m={m} />}
              </li>
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={sendText}
        className="flex items-center gap-2 border-t border-line bg-surface px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <button
          type="button"
          onClick={() => {
            setPayError(null);
            setPayOpen(true);
          }}
          className="h-11 shrink-0 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent active:opacity-90"
        >
          Pay
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message"
          maxLength={1000}
          className="h-11 min-w-0 flex-1 rounded-full border border-line bg-bg px-4 text-[15px] outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={!text.trim() || sending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-accent active:bg-accent-soft disabled:text-muted"
        >
          <SendIcon width={20} height={20} />
        </button>
      </form>

      <Sheet open={payOpen} onClose={() => setPayOpen(false)}>
        <form onSubmit={proceedToPin} className="flex flex-col items-center text-center">
          <Avatar name={friend.name} seed={friend.handle} size={56} />
          <p className="mt-2 text-sm text-muted">Paying</p>
          <VerifiedName name={friend.name} verified={friend.verified} className="max-w-full text-base font-semibold" />
          <p className="text-xs text-muted">{auraId(friend.handle)}</p>

          <label className="mt-6 flex items-center justify-center gap-1">
            <span className="text-3xl text-accent">✦</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="0"
              autoFocus
              aria-label="Amount"
              className="w-40 bg-transparent text-center text-5xl font-semibold tabular-nums outline-none placeholder:text-line"
            />
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note"
            maxLength={100}
            className="mt-4 h-10 w-56 rounded-full bg-bg px-4 text-center text-sm outline-none placeholder:text-muted"
          />
          <p className="mt-3 h-5 text-sm text-danger" role="alert">
            {payError}
          </p>
          <button
            type="submit"
            disabled={!amountValid}
            className="mt-3 h-12 w-full rounded-2xl bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-40"
          >
            {amountValid ? `Pay ✦ ${amountNum.toLocaleString()}` : "Pay"}
          </button>
        </form>
      </Sheet>

      <PinSheet
        open={pinOpen}
        mode={hasPin ? "enter" : "create"}
        title="Enter Aura PIN"
        subtitle={`Sending ✦ ${amountValid ? amountNum.toLocaleString() : 0} to ${friend.name}`}
        onClose={() => setPinOpen(false)}
        onSubmit={pay}
      />

      {sent !== null && (
        <div className="animate-fade fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-accent text-on-accent">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20">
            <CheckIcon width={40} height={40} strokeWidth={2.5} />
          </span>
          <p className="text-3xl font-semibold">✦ {sent.toLocaleString()}</p>
          <p className="text-white/80">sent to {friend.name}</p>
        </div>
      )}
    </div>
  );
}

function TextBubble({ m }: { m: Message }) {
  return (
    <div
      className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] ${
        m.mine ? "self-end rounded-br-md bg-accent text-on-accent" : "self-start rounded-bl-md bg-surface"
      }`}
    >
      <p className="break-words whitespace-pre-wrap">{m.body}</p>
      <p className={`mt-0.5 text-right text-[10px] ${m.mine ? "text-white/70" : "text-muted"}`}>{time(m.createdAt)}</p>
    </div>
  );
}

function PaymentBubble({ m, friendName }: { m: Message; friendName: string }) {
  return (
    <div
      className={`w-56 rounded-2xl border border-line bg-surface p-4 ${m.mine ? "self-end" : "self-start"}`}
    >
      <p className="text-xs text-muted">{m.mine ? `You paid ${friendName.split(" ")[0]}` : `${friendName.split(" ")[0]} paid you`}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        <span className="mr-1 text-accent">✦</span>
        {m.amount?.toLocaleString()}
      </p>
      {m.body && <p className="mt-1 text-sm break-words">{m.body}</p>}
      <p className="mt-2 flex items-center gap-1 text-xs text-success">
        <CheckIcon width={14} height={14} strokeWidth={2.5} /> Paid · {time(m.createdAt)}
      </p>
    </div>
  );
}
