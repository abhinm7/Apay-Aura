"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, Field, FormError, PrimaryButton } from "@/components/AuthShell";
import { ApiError, api, errorMessage } from "@/lib/client";
import {
  normalizePhone,
  validateHandle,
  validateName,
  validatePassword,
  validatePhone,
} from "@/lib/validate";

const suggestHandle = (name: string) =>
  name.toLowerCase().trim().replace(/\s+/g, ".").replace(/[^a-z0-9._]/g, "").slice(0, 20);

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"account" | "handle">("account");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function next(e: React.FormEvent) {
    e.preventDefault();
    const err = validateName(name) ?? validatePhone(normalizePhone(phone)) ?? validatePassword(password);
    if (err) return setError(err);
    setError(null);
    if (!handle) setHandle(suggestHandle(name));
    setStep("handle");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const err = validateHandle(handle);
    if (err) return setError(err);
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/signup", { name, phone, password, handle });
      router.replace("/");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.data.field === "account") setStep("account");
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (step === "account") {
    return (
      <AuthShell title="Create your account" subtitle="Step 1 of 2 — your details">
        <form onSubmit={next} className="flex flex-1 flex-col gap-4">
          <Field label="Full name" autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Field
            label="Phone number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <FormError message={error} />
          <div className="mt-auto flex flex-col gap-4 pt-6">
            <PrimaryButton type="submit">Continue</PrimaryButton>
            <p className="text-center text-sm text-muted">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-accent">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Pick your Aura ID" subtitle="Step 2 of 2 — friends use this to find and pay you">
      <form onSubmit={create} className="flex flex-1 flex-col gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Aura ID</span>
          <div className="flex h-12 items-center rounded-2xl border border-line bg-surface pr-4 focus-within:border-accent">
            <input
              className="h-full min-w-0 flex-1 bg-transparent pl-4 text-[15px] outline-none placeholder:text-muted"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              placeholder="yourname"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
              maxLength={20}
              required
            />
            <span className="text-[15px] text-muted">@aura</span>
          </div>
          <span className="mt-1.5 block text-xs text-muted">Letters, numbers, dot or underscore. You start with ✦ 1,000 aura.</span>
        </label>
        <FormError message={error} />
        <div className="mt-auto flex flex-col gap-3 pt-6">
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </PrimaryButton>
          <button type="button" onClick={() => setStep("account")} className="h-11 text-sm font-medium text-muted">
            Back
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
