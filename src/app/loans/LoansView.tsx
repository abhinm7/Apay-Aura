"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FormError, PrimaryButton } from "@/components/AuthShell";
import Avatar from "@/components/Avatar";
import PinSheet from "@/components/PinSheet";
import Sheet from "@/components/Sheet";
import VerifiedName from "@/components/VerifiedName";
import { BackIcon } from "@/components/icons";
import { api, errorMessage } from "@/lib/client";
import {
  AMOUNT_PERCENTS,
  amountOptions,
  APPROVAL_WAIT_MS,
  INSTANT_APPROVAL_PERCENT,
  instantFee,
  LOAN_FEES,
  loanQuote,
  MAX_BALANCE_MULTIPLE,
  needsVerification,
  repaidAfter,
  VERIFY_ABOVE_AMOUNT,
  VERIFY_ABOVE_MONTHS,
  WEEK_MS,
  WEEKS_PER_MONTH,
  type Bank,
  type Loan,
  type LoanStatus,
} from "@/lib/loans";
import LoansEmpty from "./LoansEmpty";

type Tab = "available" | LoanStatus;

const TABS: { id: Tab; label: string }[] = [
  { id: "available", label: "Available" },
  { id: "pending", label: "Pending" },
  { id: "ongoing", label: "Ongoing" },
  { id: "closed", label: "Closed" },
];

const aura = (n: number) => `✦ ${n.toLocaleString("en-IN")}`;
const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const months = (n: number) => `${n} month${n === 1 ? "" : "s"}`;
const plusMs = (iso: string, ms: number) => new Date(new Date(iso).getTime() + ms).toISOString();

function countdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

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

export default function LoansView({
  banks,
  loans: initialLoans,
  limit: initialLimit,
  verified,
  hasPin: initialHasPin,
}: {
  banks: Bank[];
  loans: Loan[];
  limit: number;
  verified: boolean;
  hasPin: boolean;
}) {
  const [loans, setLoans] = useState(initialLoans);
  const [limit, setLimit] = useState(initialLimit);
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [tab, setTab] = useState<Tab>("available");
  const [applying, setApplying] = useState<Bank | null>(null);
  const [instant, setInstant] = useState<Loan | null>(null);
  const [cancelling, setCancelling] = useState<Loan | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const now = useNow();

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  function update(next: Loan[]) {
    const approved = next.filter((l) => l.status === "ongoing" && loans.find((o) => o.id === l.id)?.status === "pending");
    setLoans(next);
    if (approved.length) notify(`Loan approved · ${aura(approved[0].received)} added to your balance`);
  }

  // When a countdown runs out, ask the server to approve it (retrying every few seconds).
  const lastRefresh = useRef(0);
  const due = now !== null && loans.some((l) => l.status === "pending" && new Date(l.approveAt).getTime() <= now);
  useEffect(() => {
    if (!due || Date.now() - lastRefresh.current < 4000) return;
    lastRefresh.current = Date.now();
    api<{ loans: Loan[]; limit: number }>("/api/loans")
      .then((res) => {
        update(res.loans);
        setLimit(res.limit);
      })
      .catch(() => {});
  });

  async function approveNow(pin: string) {
    if (!instant) return null;
    try {
      if (!hasPin) {
        await api("/api/pin", { pin });
        setHasPin(true);
      }
      const res = await api<{ loans: Loan[] }>(`/api/loans/${instant.id}/instant`, { pin });
      setInstant(null);
      update(res.loans);
      return null;
    } catch (err) {
      const msg = errorMessage(err);
      if (/PIN|attempt/i.test(msg)) return msg;
      setInstant(null);
      notify(msg);
      return null;
    }
  }

  async function cancelNow() {
    if (!cancelling || cancelBusy) return;
    setCancelBusy(true);
    try {
      const res = await fetch(`/api/loans/${cancelling.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (data.loans) update(data.loans);
      notify(res.ok ? "Loan cancelled" : (data.error ?? "Couldn't cancel the loan"));
    } catch {
      notify("Couldn't cancel the loan");
    } finally {
      setCancelBusy(false);
      setCancelling(null);
    }
  }

  // Banks you already have a pending or ongoing loan with can't be applied to again.
  const open = new Map(loans.filter((l) => l.status !== "closed").map((l) => [l.bank, l.status]));
  const shown = loans.filter((l) => l.status === tab);
  const bankOf = (loan: Loan) => banks.find((b) => b.id === loan.bank) ?? { name: "Unknown bank", verified: false, logoUrl: null };

  return (
    <main className="min-h-dvh pb-10">
      <header className="sticky top-0 z-10 border-b border-line bg-surface pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 px-2 pb-2">
          <Link href="/" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-line">
            <BackIcon />
          </Link>
          <h1 className="text-[17px] font-semibold">Aura Loan</h1>
        </div>
        <nav className="grid grid-cols-4 px-2" role="tablist">
          {TABS.map((t) => {
            const count = t.id === "available" ? 0 : loans.filter((l) => l.status === t.id).length;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`border-b-2 pt-1 pb-2.5 text-[13px] font-medium ${
                  active ? "border-accent text-accent" : "border-transparent text-muted"
                }`}
              >
                {t.label}
                {count > 0 && <span className="ml-1 text-[11px]">{count}</span>}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-4">
        {tab === "available" ? (
          banks.filter((b) => b.active).map((bank) => (
            <BankCard key={bank.id} bank={bank} status={open.get(bank.id)} onApply={() => setApplying(bank)} />
          ))
        ) : shown.length === 0 ? (
          <LoansEmpty key={tab} status={tab} onBrowse={() => setTab("available")} />
        ) : (
          shown.map((loan) =>
            loan.status === "pending" ? (
              <PendingCard
                key={loan.id}
                loan={loan}
                bank={bankOf(loan)}
                now={now}
                onInstant={() => setInstant(loan)}
                onCancel={() => setCancelling(loan)}
              />
            ) : loan.status === "ongoing" ? (
              <OngoingCard key={loan.id} loan={loan} bank={bankOf(loan)} />
            ) : (
              <ClosedCard key={loan.id} loan={loan} bank={bankOf(loan)} />
            ),
          )
        )}
      </div>

      <ApplySheet
        bank={applying}
        limit={limit}
        verified={verified}
        onClose={() => setApplying(null)}
        onApplied={(loan) => {
          setLoans((ls) => [loan, ...ls]);
          setApplying(null);
          setTab("pending");
          notify("Applied · approval in 2 minutes");
        }}
      />

      <PinSheet
        open={instant !== null}
        mode={hasPin ? "enter" : "create"}
        title="Enter Aura PIN"
        subtitle={instant ? `Paying ${aura(instantFee(instant.amount))} for instant approval` : undefined}
        onClose={() => setInstant(null)}
        onSubmit={approveNow}
      />

      <Sheet open={cancelling !== null} onClose={() => setCancelling(null)}>
        {cancelling && (
          <div className="flex flex-col gap-4 text-center">
            <div>
              <h2 className="text-lg font-semibold">Cancel this loan?</h2>
              <p className="mt-1 text-sm text-muted">
                Your application for {aura(cancelling.amount)} from {bankOf(cancelling).name} will be withdrawn. You can apply
                again later.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelNow}
              disabled={cancelBusy}
              className="h-12 w-full rounded-2xl bg-danger text-[15px] font-semibold text-on-accent active:opacity-90 disabled:opacity-50"
            >
              {cancelBusy ? "Cancelling…" : "Yes, cancel loan"}
            </button>
            <button
              type="button"
              onClick={() => setCancelling(null)}
              className="-mt-1 h-11 w-full rounded-2xl text-[15px] font-semibold text-accent active:bg-line"
            >
              Keep it
            </button>
          </div>
        )}
      </Sheet>

      {toast && (
        <div className="animate-fade fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
          <p className="rounded-full bg-ink px-4 py-2 text-center text-sm text-bg shadow-lg">{toast}</p>
        </div>
      )}
    </main>
  );
}

type BankLook = Pick<Bank, "name" | "verified" | "logoUrl">;

function BankHeader({ bank, aside }: { bank: BankLook; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={bank.name} seed={bank.name} src={bank.logoUrl} size={44} />
      <VerifiedName name={bank.name} verified={bank.verified} className="flex-1 text-[15px] font-semibold" />
      {aside}
    </div>
  );
}

function Details({ items }: { items: [string, string][] }) {
  return (
    <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-bg px-2 py-2.5">
          <dt className="text-[11px] text-muted">{label}</dt>
          <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Pill({ status }: { status: LoanStatus }) {
  const style = {
    pending: "bg-accent-soft text-accent",
    ongoing: "bg-success/10 text-success",
    closed: "bg-line text-muted",
  }[status];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style}`}>
      {{ pending: "Pending", ongoing: "Ongoing", closed: "Closed" }[status]}
    </span>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${value * 100}%` }} />
    </div>
  );
}

function BankCard({ bank, status, onApply }: { bank: Bank; status?: LoanStatus; onApply: () => void }) {
  return (
    <article className="rounded-2xl bg-surface p-4">
      <BankHeader bank={bank} />
      <Details
        items={[
          ["Interest", `${bank.interest}% / month`],
          ["Up to", aura(bank.upTo)],
          ["Tenure", months(bank.months)],
        ]}
      />
      {bank.months > VERIFY_ABOVE_MONTHS && <p className="mt-3 text-xs text-muted">Verified accounts only</p>}
      <button
        type="button"
        onClick={onApply}
        disabled={Boolean(status)}
        className={`mt-4 h-11 w-full rounded-2xl text-[15px] font-semibold ${
          status ? "bg-accent-soft text-accent" : "bg-accent text-on-accent active:opacity-90"
        }`}
      >
        {status === "pending" ? "Waiting for approval" : status === "ongoing" ? "Loan ongoing" : "Apply"}
      </button>
    </article>
  );
}

function PendingCard({
  loan,
  now,
  bank,
  onInstant,
  onCancel,
}: {
  loan: Loan;
  bank: BankLook;
  now: number | null;
  onInstant: () => void;
  onCancel: () => void;
}) {
  const left = now === null ? APPROVAL_WAIT_MS : new Date(loan.approveAt).getTime() - now;
  return (
    <article className="rounded-2xl bg-surface p-4">
      <BankHeader bank={bank} aside={<Pill status="pending" />} />
      <div className="mt-4 rounded-xl bg-bg px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">{left > 0 ? "Approves in" : "Approving…"}</span>
          <span className="text-2xl font-semibold tabular-nums">{countdown(left)}</span>
        </div>
        <div className="mt-2">
          <Bar value={1 - Math.max(0, left) / APPROVAL_WAIT_MS} />
        </div>
      </div>
      <Details
        items={[
          ["Amount", aura(loan.amount)],
          ["You get", aura(loan.received)],
          ["EMI / week", aura(loan.emi)],
        ]}
      />
      <button
        type="button"
        onClick={onInstant}
        disabled={left <= 0}
        className="mt-4 h-11 w-full rounded-2xl bg-accent text-[15px] font-semibold text-on-accent active:opacity-90 disabled:opacity-50"
      >
        Approve instantly · Pay {aura(instantFee(loan.amount))}
      </button>
      <p className="mt-2 text-center text-xs text-muted">{INSTANT_APPROVAL_PERCENT}% of the loan amount, not refundable</p>
      {left > 0 && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 h-10 w-full rounded-2xl text-sm font-semibold text-danger active:bg-line"
        >
          Cancel loan
        </button>
      )}
    </article>
  );
}

function OngoingCard({ loan, bank }: { loan: Loan; bank: BankLook }) {
  const repaid = repaidAfter(loan, loan.emisPaid);
  const nextEmi = loan.emisPaid + 1 === loan.weeks ? loan.total - loan.emi * (loan.weeks - 1) : loan.emi;
  return (
    <article className="rounded-2xl bg-surface p-4">
      <BankHeader bank={bank} aside={<Pill status="ongoing" />} />
      <Details
        items={[
          ["Borrowed", aura(loan.amount)],
          ["EMI / week", aura(loan.emi)],
          ["Left to pay", aura(loan.total - repaid)],
        ]}
      />
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>
            {loan.emisPaid} of {loan.weeks} EMIs paid
          </span>
          <span>
            {aura(repaid)} / {aura(loan.total)}
          </span>
        </div>
        <Bar value={repaid / loan.total} />
      </div>
      {loan.approvedAt && (
        <p className="mt-3 text-xs text-muted">
          Next EMI {aura(nextEmi)} on {dateFmt(plusMs(loan.approvedAt, (loan.emisPaid + 1) * WEEK_MS))}
        </p>
      )}
    </article>
  );
}

function ClosedCard({ loan, bank }: { loan: Loan; bank: BankLook }) {
  return (
    <article className="rounded-2xl bg-surface p-4">
      <BankHeader bank={bank} aside={<Pill status="closed" />} />
      <Details
        items={[
          ["Borrowed", aura(loan.amount)],
          ["Repaid", aura(loan.total)],
          ["EMIs", `${loan.weeks}`],
        ]}
      />
      {loan.closedAt && <p className="mt-3 text-xs text-muted">Closed {dateFmt(loan.closedAt)}</p>}
    </article>
  );
}

function ApplySheet({
  bank,
  limit,
  verified,
  onClose,
  onApplied,
}: {
  bank: Bank | null;
  limit: number;
  verified: boolean;
  onClose: () => void;
  onApplied: (loan: Loan) => void;
}) {
  const [amount, setAmount] = useState(0);
  const [pledged, setPledged] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shownFor, setShownFor] = useState<Bank | null>(null);

  const options = bank ? amountOptions(Math.max(0, Math.min(bank.upTo, limit))) : [];
  const allowed = (a: number) => verified || !bank || !needsVerification(a, bank.months);

  // Start fresh each time the sheet opens, on the largest amount you're allowed.
  if (bank !== shownFor) {
    setShownFor(bank);
    setAmount(options.find(allowed) ?? options[0] ?? 0);
    setPledged(false);
    setError(null);
  }
  if (!bank) return null;

  const blocked = amount > 0 && !allowed(amount);
  const q = loanQuote(amount, bank);
  const valid = amount > 0 && !blocked && pledged;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy || !bank) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ loan: Loan }>("/api/loans", { bank: bank.id, amount, pledge: true });
      onApplied(res.loan);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet open={!terms} onClose={onClose}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold">Apply for a loan</h2>
            <p className="text-sm text-muted">
              {bank.name} · {bank.interest}% / month · {months(bank.months)}
            </p>
          </div>

          {options.length === 0 ? (
            <p className="rounded-xl bg-bg px-3 py-3 text-center text-sm text-muted">
              Your balance is too low to borrow. You can borrow up to {MAX_BALANCE_MULTIPLE}× your balance.
            </p>
          ) : (
            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium">How much do you need?</legend>
              <div className="grid grid-cols-3 gap-2">
                {options.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={amount === a}
                    onClick={() => setAmount(a)}
                    className={`h-11 rounded-2xl border text-sm font-semibold tabular-nums ${
                      amount === a ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"
                    } ${allowed(a) ? "" : "opacity-50"}`}
                  >
                    {aura(a)}
                  </button>
                ))}
              </div>
              <span className="mt-1.5 block text-xs text-muted">
                {AMOUNT_PERCENTS.join(", ")}% of the most you can borrow (up to {aura(bank.upTo)}, max {MAX_BALANCE_MULTIPLE}× your balance)
              </span>
            </fieldset>
          )}

          {blocked && (
            <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
              Loans over {aura(VERIFY_ABOVE_AMOUNT)} or longer than {VERIFY_ABOVE_MONTHS} months need a verified account.{" "}
              <Link href="/profile/verify" className="font-semibold underline">
                Get verified
              </Link>
            </p>
          )}

          {amount > 0 && (
            <dl className="divide-y divide-line rounded-2xl border border-line text-sm">
              <div className="px-4 py-2.5">
                <Line label="Loan amount" value={aura(amount)} strong />
                {q.fees.map((f) => (
                  <Line key={f.label} label={`${f.label} (${f.percent}%)`} value={`− ${aura(f.value)}`} muted />
                ))}
                <Line label="You receive" value={aura(q.received)} strong />
              </div>
              <div className="px-4 py-2.5">
                <Line label={`Interest (${bank.interest}% × ${months(bank.months)})`} value={aura(q.interest)} muted />
                <Line label="Total to repay" value={aura(q.total)} strong />
              </div>
              <div className="px-4 py-2.5">
                <Line label="Weekly EMI" value={`${aura(q.emi)} × ${q.weeks}`} strong />
                {q.lastEmi !== q.emi && <Line label="Last EMI" value={aura(q.lastEmi)} muted />}
                <Line label="First EMI" value="1 week after approval" muted />
                <Line label="Approval" value={`In 2 min, or instantly for ${aura(instantFee(amount))}`} muted />
              </div>
            </dl>
          )}

          <label className="flex items-start gap-3 rounded-2xl bg-bg px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={pledged}
              onChange={(e) => setPledged(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
            />
            <span>
              I pledge to repay this aura loan. Weekly EMIs are taken from my balance automatically,{" "}
              <strong>even if it goes below zero</strong>.
            </span>
          </label>

          <FormError message={error} />

          <PrimaryButton type="submit" disabled={!valid || busy}>
            {amount > 0 ? `Apply for ${aura(amount)}` : "Apply"}
          </PrimaryButton>
          <button type="button" onClick={() => setTerms(true)} className="-mt-1 text-sm font-medium text-accent">
            Terms &amp; conditions
          </button>
        </form>
      </Sheet>

      <Sheet open={terms} onClose={() => setTerms(false)}>
        <div className="flex flex-col gap-4">
          <h2 className="text-center text-lg font-semibold">Terms &amp; conditions</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>
              You can borrow up to the bank&apos;s limit and at most {MAX_BALANCE_MULTIPLE}× your current balance, in the amounts
              offered.
            </li>
            <li>
              {LOAN_FEES.map((f) => `${f.label} (${f.percent}%)`).join(", ")} are taken from the loan before it&apos;s paid
              out. You repay the full loan amount.
            </li>
            <li>Interest is simple interest at the bank&apos;s monthly rate, for the whole tenure.</li>
            <li>
              Loans are approved automatically 2 minutes after you apply. You can pay {INSTANT_APPROVAL_PERCENT}% of the loan
              amount to approve it instantly; this fee isn&apos;t refundable.
            </li>
            <li>
              You repay in weekly EMIs ({WEEKS_PER_MONTH} per month of tenure). The first EMI is taken one week after
              approval.
            </li>
            <li>
              EMIs are taken from your balance automatically, even if that makes it negative. While your balance is
              negative you can&apos;t send aura.
            </li>
            <li>
              Loans over {aura(VERIFY_ABOVE_AMOUNT)} or longer than {VERIFY_ABOVE_MONTHS} months need a verified account.
            </li>
            <li>You can have one pending or ongoing loan per bank.</li>
            <li>You can cancel a loan while it&apos;s pending. Once approved, it can&apos;t be cancelled.</li>
            <li>Aura has no real-world value.</li>
          </ol>
          <PrimaryButton type="button" onClick={() => setTerms(false)}>
            Got it
          </PrimaryButton>
        </div>
      </Sheet>
    </>
  );
}

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-0.5 ${muted ? "text-muted" : ""}`}>
      <dt>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}
