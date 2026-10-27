"use client";

import { useEffect } from "react";

// Bottom sheet used for the PIN pad and the pay screen. Sets its own text
// color, since it's often rendered inside colored cards (e.g. the balance card).
export default function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="animate-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal
        className="animate-sheet no-scrollbar relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface px-5 text-ink pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        {children}
      </div>
    </div>
  );
}
