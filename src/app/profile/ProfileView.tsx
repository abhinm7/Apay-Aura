"use client";

import { Calendar, ChevronRight, KeyRound, LockKeyhole, Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormError, PrimaryButton } from "@/components/AuthShell";
import Avatar from "@/components/Avatar";
import PinSheet from "@/components/PinSheet";
import Sheet from "@/components/Sheet";
import VerifiedName from "@/components/VerifiedName";
import { BackIcon } from "@/components/icons";
import { api, errorMessage } from "@/lib/client";
import type { Profile } from "@/lib/queries";
import { auraId } from "@/lib/validate";

type Open = "name" | "addId" | "password" | "pinCurrent" | "pinNew" | "pinCreate" | null;

const joined = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const phoneFmt = (p: string) => `+91 ${p.slice(0, 5)} ${p.slice(5)}`;

export default function ProfileView({
  profile: initial,
  hasPin: initialHasPin,
  maxAuraIds,
}: {
  profile: Profile;
  hasPin: boolean;
  maxAuraIds: number;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [open, setOpen] = useState<Open>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form fields
  const [name, setName] = useState(profile.name);
  const [newId, setNewId] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [currentPin, setCurrentPin] = useState("");

  function show(sheet: Open) {
    setError(null);
    setOpen(sheet);
  }
  function done(message: string) {
    setOpen(null);
    setToast(message);
    setTimeout(() => setToast(null), 2200);
    router.refresh();
  }

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await api<{ name: string }>("/api/profile/name", { name });
      setProfile((p) => ({ ...p, name: res.name }));
      done("Name updated");
    });
  };

  async function idAction(action: "add" | "remove" | "main", handle: string) {
    const res = await api<{ handle: string; auraIds: string[] }>("/api/profile/aura-ids", { action, handle });
    setProfile((p) => ({ ...p, handle: res.handle, auraIds: res.auraIds }));
  }

  const addId = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await idAction("add", newId);
      setNewId("");
      done("Aura ID added");
    });
  };

  async function removeId(handle: string) {
    if (!confirm(`Remove ${auraId(handle)}?\n\nPayments to it will stop reaching you, and anyone can claim it afterwards.`)) return;
    try {
      await idAction("remove", handle);
      done("Aura ID removed");
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function makeMain(handle: string) {
    try {
      await idAction("main", handle);
      done(`${auraId(handle)} is now your main Aura ID`);
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api("/api/profile/password", { current: currentPw, next: nextPw });
      setCurrentPw("");
      setNextPw("");
      done("Password changed");
    });
  };

  // PIN: verify the current one, then collect the new one (entered twice).
  async function verifyCurrentPin(pin: string) {
    try {
      await api("/api/pin/change", { current: pin });
      setCurrentPin(pin);
      setOpen("pinNew");
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }
  async function saveNewPin(pin: string) {
    try {
      await api("/api/pin/change", { current: currentPin, next: pin });
      setCurrentPin("");
      done("Aura PIN changed");
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }
  async function createPin(pin: string) {
    try {
      await api("/api/pin", { pin });
      setHasPin(true);
      done("Aura PIN created");
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }

  const canAddId = profile.auraIds.length < maxAuraIds;

  return (
    <main className="min-h-dvh pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <Link href="/" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-line">
          <BackIcon />
        </Link>
        <h1 className="text-[17px] font-semibold">Profile</h1>
      </header>

      <div className="flex flex-col items-center px-4 pt-8">
        <Avatar name={profile.name} seed={profile.handle} size={84} />
        <VerifiedName name={profile.name} verified={profile.verified} className="mt-3 max-w-full text-xl font-semibold" />
        <p className="text-sm text-muted">{auraId(profile.handle)}</p>
      </div>

      <div className="mt-8 flex flex-col gap-6 px-4">
        {/* Details */}
        <Card title="Details">
          <Row icon={<Pencil size={18} />} label="Name" value={profile.name} onClick={() => (setName(profile.name), show("name"))} />
          <Row icon={<Phone size={18} />} label="Phone" value={phoneFmt(profile.phone)} />
          <Row icon={<Calendar size={18} />} label="Member since" value={joined(profile.createdAt)} />
        </Card>

        {/* Aura IDs */}
        <Card title={`Aura IDs · ${profile.auraIds.length}/${maxAuraIds}`}>
          {profile.auraIds.map((h) => {
            const main = h === profile.handle;
            return (
              <li key={h} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-[15px]">{auraId(h)}</span>
                {main ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Main</span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => makeMain(h)}
                      aria-label={`Make ${auraId(h)} main`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-line"
                    >
                      <Star size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeId(h)}
                      aria-label={`Remove ${auraId(h)}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-danger active:bg-line"
                    >
                      <Trash2 size={17} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
          {canAddId && (
            <li>
              <button
                type="button"
                onClick={() => (setNewId(""), show("addId"))}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-accent active:bg-line"
              >
                <Plus size={18} /> Add Aura ID
              </button>
            </li>
          )}
        </Card>
        <p className="-mt-4 px-1 text-xs text-muted">
          Anyone can pay you with any of your Aura IDs. Your main ID is shown on your profile and QR.
        </p>

        {/* Security */}
        <Card title="Security">
          <Row icon={<KeyRound size={18} />} label="Change password" onClick={() => (setCurrentPw(""), setNextPw(""), show("password"))} />
          <Row
            icon={<LockKeyhole size={18} />}
            label={hasPin ? "Change Aura PIN" : "Create Aura PIN"}
            onClick={() => show(hasPin ? "pinCurrent" : "pinCreate")}
          />
        </Card>
      </div>

      {/* Change name */}
      <Sheet open={open === "name"} onClose={() => setOpen(null)}>
        <form onSubmit={saveName} className="flex flex-col gap-4">
          <h2 className="text-center text-lg font-semibold">Change name</h2>
          <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus required />
          <FormError message={error} />
          <PrimaryButton type="submit" disabled={busy || name.trim() === profile.name}>
            Save
          </PrimaryButton>
        </form>
      </Sheet>

      {/* Add Aura ID */}
      <Sheet open={open === "addId"} onClose={() => setOpen(null)}>
        <form onSubmit={addId} className="flex flex-col gap-4">
          <h2 className="text-center text-lg font-semibold">Add Aura ID</h2>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">New Aura ID</span>
            <span className="flex h-12 items-center rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
              <input
                value={newId}
                onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 20))}
                placeholder="yourname"
                autoFocus
                autoCapitalize="none"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
              />
              <span className="text-[15px] text-muted">@aura</span>
            </span>
            <span className="mt-1.5 block text-xs text-muted">Letters, numbers, dot or underscore.</span>
          </label>
          <FormError message={error} />
          <PrimaryButton type="submit" disabled={busy || newId.length < 3}>
            Add
          </PrimaryButton>
        </form>
      </Sheet>

      {/* Change password */}
      <Sheet open={open === "password"} onClose={() => setOpen(null)}>
        <form onSubmit={savePassword} className="flex flex-col gap-4">
          <h2 className="text-center text-lg font-semibold">Change password</h2>
          <Field
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoFocus
            required
          />
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 6 characters"
            value={nextPw}
            onChange={(e) => setNextPw(e.target.value)}
            required
          />
          <FormError message={error} />
          <PrimaryButton type="submit" disabled={busy || !currentPw || nextPw.length < 6}>
            Change password
          </PrimaryButton>
        </form>
      </Sheet>

      {/* Aura PIN */}
      <PinSheet
        open={open === "pinCurrent"}
        mode="enter"
        title="Enter current Aura PIN"
        subtitle="To change your Aura PIN"
        onClose={() => setOpen(null)}
        onSubmit={verifyCurrentPin}
      />
      <PinSheet
        open={open === "pinNew"}
        mode="create"
        title="New Aura PIN"
        createHeading="Enter new Aura PIN"
        onClose={() => setOpen(null)}
        onSubmit={saveNewPin}
      />
      <PinSheet open={open === "pinCreate"} mode="create" title="Create Aura PIN" onClose={() => setOpen(null)} onSubmit={createPin} />

      {toast && (
        <div className="animate-fade fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
          <p className="rounded-full bg-ink px-4 py-2 text-sm text-bg shadow-lg">{toast}</p>
        </div>
      )}
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-medium text-muted">{title}</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">{children}</ul>
    </section>
  );
}

function Row({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="shrink-0 text-muted">{icon}</span>
      <span className="flex-1 text-[15px]">{label}</span>
      {value && <span className="max-w-[55%] truncate text-sm text-muted">{value}</span>}
      {onClick && <ChevronRight size={18} className="shrink-0 text-muted" />}
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-line">
          {inner}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
      )}
    </li>
  );
}
