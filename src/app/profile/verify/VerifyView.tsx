"use client";

import { Camera } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormError, PrimaryButton } from "@/components/AuthShell";
import Avatar from "@/components/Avatar";
import PinSheet from "@/components/PinSheet";
import VerifiedName, { VerifiedBadge } from "@/components/VerifiedName";
import { BackIcon } from "@/components/icons";
import { api, errorMessage, uploadAvatar } from "@/lib/client";
import { auraId } from "@/lib/validate";
import { MAX_ADDRESS, OCCUPATIONS, VERIFY_FEE, type Occupation } from "@/lib/verification";

const fee = VERIFY_FEE.toLocaleString();

export default function VerifyView({
  name,
  handle,
  avatarUrl: initialAvatar,
  verified: initialVerified,
  hasPin: initialHasPin,
}: {
  name: string;
  handle: string;
  avatarUrl: string | null;
  verified: boolean;
  hasPin: boolean;
}) {
  const router = useRouter();
  const [verified, setVerified] = useState(initialVerified);
  const [justVerified, setJustVerified] = useState(false);
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [address, setAddress] = useState("");
  const [occupation, setOccupation] = useState<Occupation | null>(null);
  const [income, setIncome] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);

  const ready = Boolean(avatarUrl) && address.trim().length >= 10 && occupation !== null && income !== "";

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setAvatarUrl(await uploadAvatar(file));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    setPinOpen(true);
  }

  async function pay(pin: string) {
    try {
      if (!hasPin) {
        await api("/api/pin", { pin });
        setHasPin(true);
      }
      await api("/api/verify", { address, occupation, monthlyIncome: Number(income), pin });
      setPinOpen(false);
      setVerified(true);
      setJustVerified(true);
      router.refresh();
      return null;
    } catch (err) {
      const msg = errorMessage(err);
      // PIN problems stay on the PIN pad; anything else goes back to the form.
      if (/PIN|attempt/i.test(msg)) return msg;
      setPinOpen(false);
      setError(msg);
      return null;
    }
  }

  return (
    <main className="min-h-dvh pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <Link href="/profile" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-line">
          <BackIcon />
        </Link>
        <h1 className="text-[17px] font-semibold">Verified badge</h1>
      </header>

      {verified ? (
        <div className="animate-fade flex flex-col items-center px-6 pt-14 text-center">
          <Avatar name={name} seed={handle} src={avatarUrl} size={84} />
          <VerifiedName name={name} verified className="mt-3 max-w-full text-xl font-semibold" badgeSize={20} />
          <p className="text-sm text-muted">{auraId(handle)}</p>
          <p className="mt-8 text-lg font-semibold">{justVerified ? "You're verified!" : "You're already verified"}</p>
          <p className="mt-1 text-sm text-muted">The badge shows next to your name everywhere in apay.</p>
          <Link
            href="/profile"
            className="mt-8 flex h-12 w-full items-center justify-center rounded-2xl bg-accent text-[15px] font-semibold text-on-accent active:opacity-90"
          >
            Back to profile
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-6 px-4 pt-6">
          <div className="flex flex-col items-center text-center">
            <VerifiedBadge size={48} />
            <h2 className="mt-3 text-xl font-semibold">Get the verified badge</h2>
          </div>

          {/* Profile photo (required) */}
          <section>
            <h3 className="mb-2 px-1 text-xs font-medium text-muted">Profile photo</h3>
            <div className="flex items-center gap-4 rounded-2xl bg-surface px-4 py-3">
              <span className="relative">
                <Avatar name={name} seed={handle} src={avatarUrl} size={56} />
                {uploading && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  </span>
                )}
              </span>
              <p className="min-w-0 flex-1 text-sm text-muted">
                {avatarUrl ? "Make sure it clearly shows your face." : "A clear photo of your face is required."}
              </p>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent disabled:opacity-50"
              >
                <Camera size={15} /> {avatarUrl ? "Change" : "Add"}
              </button>
              <input ref={fileInput} type="file" accept="image/*" onChange={uploadPhoto} hidden />
            </div>
          </section>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Address</span>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={MAX_ADDRESS}
              rows={3}
              placeholder="House, street, city, PIN code"
              autoComplete="street-address"
              className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none placeholder:text-muted focus:border-accent"
            />
          </label>

          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium">What do you do?</legend>
            <div className="grid grid-cols-3 gap-2">
              {OCCUPATIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={occupation === o.value}
                  onClick={() => setOccupation(o.value)}
                  className={`h-11 rounded-2xl border text-sm font-medium ${
                    occupation === o.value ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Monthly income</span>
            <span className="flex h-12 items-center gap-1 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
              <span className="text-[15px] text-muted">₹</span>
              <input
                value={income}
                onChange={(e) => setIncome(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9))}
                inputMode="numeric"
                placeholder="0"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
              />
            </span>
            {income && <span className="mt-1.5 block text-xs text-muted">₹ {Number(income).toLocaleString("en-IN")} a month</span>}
          </label>

          <FormError message={error} />

          <div>
            <PrimaryButton type="submit" disabled={!ready || uploading}>
              Verify · Pay ✦ {fee}
            </PrimaryButton>
            <p className="mt-2 text-center text-xs text-muted">The fee is taken from your aura balance and isn&apos;t refundable.</p>
          </div>
        </form>
      )}

      <PinSheet
        open={pinOpen}
        mode={hasPin ? "enter" : "create"}
        title="Enter Aura PIN"
        subtitle={`Paying ✦ ${fee} for the verified badge`}
        onClose={() => setPinOpen(false)}
        onSubmit={pay}
      />
    </main>
  );
}
