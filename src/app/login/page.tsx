"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, Field, FormError, PrimaryButton } from "@/components/AuthShell";
import { api, errorMessage } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { phone, password });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to send and receive aura.">
      <form onSubmit={submit} className="flex flex-1 flex-col gap-4">
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
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <FormError message={error} />
        <div className="mt-auto flex flex-col gap-4 pt-6">
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </PrimaryButton>
          <p className="text-center text-sm text-muted">
            New to apay?{" "}
            <Link href="/signup" className="font-medium text-accent">
              Create an account
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
