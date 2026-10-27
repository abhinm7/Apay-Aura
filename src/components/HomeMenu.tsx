"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { disablePush, enablePush, pushStatus, type PushStatus } from "@/lib/pushClient";
import { BellIcon, LogoutIcon, MenuIcon } from "./icons";

// Hamburger in the top bar; holds notifications and sign out.
export default function HomeMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [push, setPush] = useState<PushStatus>("unsupported");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pushStatus().then(setPush).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function togglePush() {
    if (busy) return;
    setBusy(true);
    try {
      if (push === "on") await disablePush();
      else await enablePush();
    } catch {
      // Fall through to re-read the real state.
    }
    setPush(await pushStatus().catch(() => push));
    setBusy(false);
  }

  async function logout() {
    await disablePush().catch(() => {});
    await api("/api/auth/logout", {});
    router.replace("/login");
    router.refresh();
  }

  const item = "flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] active:bg-line disabled:opacity-60";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full text-ink active:bg-line"
      >
        <MenuIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="animate-fade absolute top-11 right-0 z-40 w-60 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-lg"
        >
          {push !== "unsupported" && (
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={push === "on"}
              onClick={togglePush}
              disabled={busy || push === "blocked"}
              className={item}
            >
              <BellIcon width={18} height={18} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                Notifications
                {push === "blocked" && (
                  <span className="block text-xs text-muted">Blocked — allow in browser settings</span>
                )}
              </span>
              {push !== "blocked" && (
                // Switch
                <span
                  className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                    push === "on" ? "bg-accent" : "bg-line"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${
                      push === "on" ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </span>
              )}
            </button>
          )}
          <button type="button" role="menuitem" onClick={logout} className={`${item} text-danger`}>
            <LogoutIcon width={18} height={18} className="shrink-0" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
