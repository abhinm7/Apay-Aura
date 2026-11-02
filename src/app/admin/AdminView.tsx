"use client";

import { Camera, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Field, FormError, PrimaryButton, Wordmark } from "@/components/AuthShell";
import Avatar from "@/components/Avatar";
import Sheet from "@/components/Sheet";
import VerifiedName from "@/components/VerifiedName";
import { api, errorMessage, uploadImage } from "@/lib/client";
import { validateBank, type Bank, type BankInput, type LoanStatus } from "@/lib/loans";

type Counts = Record<string, Partial<Record<LoanStatus, number>>>;

const aura = (n: number) => `✦ ${n.toLocaleString("en-IN")}`;
const BLANK: BankInput = { name: "", interest: 10, upTo: 50_000, months: 3, verified: false, active: true };

export default function AdminView({ banks: initial, counts }: { banks: Bank[]; counts: Counts }) {
  const router = useRouter();
  const [banks, setBanks] = useState(initial);
  // The bank being edited, or "new" while adding one.
  const [editing, setEditing] = useState<Bank | "new" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  function saved(bank: Bank, message: string) {
    setBanks((bs) => (bs.some((b) => b.id === bank.id) ? bs.map((b) => (b.id === bank.id ? bank : b)) : [...bs, bank]));
    setEditing(bank);
    notify(message);
  }

  async function lock() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.refresh();
  }

  return (
    <main className="min-h-dvh pb-10">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-baseline gap-2">
          <Wordmark />
          <span className="text-sm font-medium text-muted">admin</span>
        </div>
        <button type="button" onClick={lock} className="rounded-full px-3 py-1.5 text-sm font-medium text-danger active:bg-line">
          Lock
        </button>
      </header>

      <div className="px-4">
        <div className="flex items-center justify-between pt-5 pb-2">
          <h1 className="text-xs font-medium text-muted">Loan banks · {banks.length}</h1>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
          >
            <Plus size={16} /> Add bank
          </button>
        </div>

        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
          {banks.map((bank) => {
            const c = counts[bank.id] ?? {};
            const loans = [
              c.pending && `${c.pending} pending`,
              c.ongoing && `${c.ongoing} ongoing`,
              c.closed && `${c.closed} closed`,
            ].filter(Boolean);
            return (
              <li key={bank.id}>
                <button
                  type="button"
                  onClick={() => setEditing(bank)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-line ${bank.active ? "" : "opacity-60"}`}
                >
                  <Avatar name={bank.name} seed={bank.name} src={bank.logoUrl} size={44} />
                  <span className="min-w-0 flex-1">
                    <VerifiedName name={bank.name} verified={bank.verified} className="text-[15px] font-semibold" />
                    <span className="block truncate text-xs text-muted">
                      {bank.interest}% / month · up to {aura(bank.upTo)} · {bank.months} mo
                    </span>
                    <span className="block truncate text-xs text-muted">{loans.length ? loans.join(" · ") : "No loans yet"}</span>
                  </span>
                  {!bank.active && (
                    <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-[11px] font-semibold text-muted">Hidden</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 px-1 text-xs text-muted">
          Changes apply to new loans. Existing loans keep the interest and tenure they were taken on.
        </p>
      </div>

      <BankSheet
        key={editing === "new" ? "new" : editing?.id ?? "none"}
        bank={editing}
        onClose={() => setEditing(null)}
        onSaved={saved}
      />

      {toast && (
        <div className="animate-fade fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
          <p className="rounded-full bg-ink px-4 py-2 text-sm text-bg shadow-lg">{toast}</p>
        </div>
      )}
    </main>
  );
}

function BankSheet({
  bank,
  onClose,
  onSaved,
}: {
  bank: Bank | "new" | null;
  onClose: () => void;
  onSaved: (bank: Bank, message: string) => void;
}) {
  const existing = bank && bank !== "new" ? bank : null;
  const start = existing ?? BLANK;
  const [name, setName] = useState(start.name);
  const [interest, setInterest] = useState(String(start.interest));
  const [upTo, setUpTo] = useState(String(start.upTo));
  const [months, setMonths] = useState(String(start.months));
  const [verified, setVerified] = useState(start.verified);
  const [active, setActive] = useState(start.active);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!bank) return null;

  const input: BankInput = {
    name: name.trim(),
    interest: Number(interest),
    upTo: Number(upTo),
    months: Number(months),
    verified,
    active,
  };
  const digits = (set: (v: string) => void, max: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(e.target.value.replace(/\D/g, "").slice(0, max));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateBank(input);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ bank: Bank }>(existing ? `/api/admin/banks/${existing.id}` : "/api/admin/banks", input);
      onSaved(res.bank, existing ? "Bank saved" : "Bank added · you can add a logo now");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !existing) return;
    setUploading(true);
    setError(null);
    try {
      const logoUrl = await uploadImage(`/api/admin/banks/${existing.id}/logo`, file);
      onSaved({ ...existing, logoUrl }, "Logo updated");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    if (!existing) return;
    setUploading(true);
    const res = await fetch(`/api/admin/banks/${existing.id}/logo`, { method: "DELETE" });
    setUploading(false);
    if (res.ok) onSaved({ ...existing, logoUrl: null }, "Logo removed");
    else setError("Couldn't remove the logo");
  }

  return (
    <Sheet open onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <h2 className="text-center text-lg font-semibold">{existing ? "Edit bank" : "Add bank"}</h2>

        {existing ? (
          <div className="flex items-center gap-4 rounded-2xl border border-line px-4 py-3">
            <span className="relative">
              <Avatar name={existing.name} seed={existing.name} src={existing.logoUrl} size={56} />
              {uploading && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                </span>
              )}
            </span>
            <span className="flex-1 text-sm text-muted">Logo</span>
            {existing.logoUrl && (
              <button
                type="button"
                onClick={removeLogo}
                disabled={uploading}
                aria-label="Remove logo"
                className="flex h-9 w-9 items-center justify-center rounded-full text-danger active:bg-line disabled:opacity-50"
              >
                <Trash2 size={17} />
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent disabled:opacity-50"
            >
              <Camera size={15} /> {existing.logoUrl ? "Change" : "Add"}
            </button>
            <input ref={fileInput} type="file" accept="image/*" onChange={uploadLogo} hidden />
          </div>
        ) : (
          <p className="text-center text-xs text-muted">You can add a logo after saving.</p>
        )}

        <Field label="Bank name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Interest (% / month)" value={interest} onChange={digits(setInterest, 3)} inputMode="numeric" required />
          <Field label="Tenure (months)" value={months} onChange={digits(setMonths, 2)} inputMode="numeric" required />
        </div>
        <Field
          label="Lends up to (✦)"
          value={upTo}
          onChange={digits(setUpTo, 8)}
          inputMode="numeric"
          hint={Number(upTo) > 0 ? aura(Number(upTo)) : undefined}
          required
        />

        <div className="divide-y divide-line rounded-2xl border border-line">
          <Toggle label="Verified badge" hint="Shows the badge next to the bank's name" on={verified} onChange={setVerified} />
          <Toggle label="Show to users" hint="Hidden banks can't be applied to" on={active} onChange={setActive} />
        </div>

        <FormError message={error} />
        <PrimaryButton type="submit" disabled={busy}>
          {existing ? "Save changes" : "Add bank"}
        </PrimaryButton>
      </form>
    </Sheet>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
