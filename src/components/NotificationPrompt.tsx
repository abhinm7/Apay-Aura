"use client";

import { useEffect, useState } from "react";
import { enablePush, pushSupported, syncPush } from "@/lib/pushClient";
import { BellIcon } from "./icons";

const SEEN_KEY = "apay_push_prompt_seen";

export default function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    if (Notification.permission === "granted") {
      syncPush().catch(() => {});
      return;
    }
    if (Notification.permission !== "default") return;
    // Shown only once per device: mark it as seen as soon as it appears.
    try {
      if (localStorage.getItem(SEEN_KEY) === "1") return;
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setShow(true);
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      const permission = await enablePush();
      if (permission === "granted") setShow(false);
      else if (permission === "denied") setDenied(true);
    } catch {
      setDenied(true);
    } finally {
      setBusy(false);
    }
  }

  function notNow() {
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <BellIcon width={18} height={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">Turn on notifications</p>
        <p className="mt-0.5 text-sm text-muted">
          {denied
            ? "Notifications are blocked. Allow them for this site in your browser settings."
            : "Know when friends message you or send you aura."}
        </p>
        {!denied && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={turnOn}
              disabled={busy}
              className="h-9 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60"
            >
              Turn on
            </button>
            <button type="button" onClick={notNow} className="h-9 rounded-full px-3 text-sm text-muted active:bg-line">
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
