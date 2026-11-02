"use client";

import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/AuthShell";
import PinSheet from "@/components/PinSheet";
import { api, errorMessage } from "@/lib/client";

export default function AdminLogin() {
  const router = useRouter();

  async function unlock(pin: string) {
    try {
      await api("/api/admin/session", { pin });
      router.refresh();
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center px-5 pt-[max(3rem,env(safe-area-inset-top))]">
      <Wordmark />
      <p className="mt-2 text-sm text-muted">Admin</p>
      <PinSheet open mode="enter" title="Enter admin PIN" subtitle="To manage loan banks" onClose={() => {}} onSubmit={unlock} />
    </main>
  );
}
