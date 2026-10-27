"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { disablePush } from "@/lib/pushClient";
import { LogoutIcon, MenuIcon } from "./icons";

// Hamburger in the top bar; holds account actions (sign out for now).
export default function HomeMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  async function logout() {
    await disablePush().catch(() => {});
    await api("/api/auth/logout", {});
    router.replace("/login");
    router.refresh();
  }

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
          className="animate-fade absolute top-11 right-0 z-40 w-44 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-danger active:bg-line"
          >
            <LogoutIcon width={18} height={18} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
