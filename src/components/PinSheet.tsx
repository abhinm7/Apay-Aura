"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sheet from "./Sheet";
import { BackspaceIcon } from "./icons";

const LENGTH = 4;

type Props = {
  open: boolean;
  // "create" asks for the PIN twice before calling onSubmit.
  mode: "enter" | "create";
  title: string;
  subtitle?: string;
  // Heading for the first step of "create" (e.g. when changing an existing PIN).
  createHeading?: string;
  onClose: () => void;
  // Resolve with an error message to keep the sheet open, or null on success.
  onSubmit: (pin: string) => Promise<string | null>;
};

export default function PinSheet({
  open,
  mode,
  title,
  subtitle,
  createHeading = "Create your Aura PIN",
  onClose,
  onSubmit,
}: Props) {
  const [digits, setDigits] = useState("");
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDigits("");
      setFirst(null);
      setError(null);
    }
  }, [open]);

  const confirming = mode === "create" && first !== null;
  const heading = mode === "create" ? (confirming ? "Confirm your Aura PIN" : createHeading) : title;
  const hint =
    mode === "create"
      ? confirming
        ? "Enter the same 4 digits again"
        : "You'll use this PIN to see your balance and send aura"
      : subtitle;

  const submit = useCallback(
    async (pin: string) => {
      if (mode === "create" && first === null) {
        setFirst(pin);
        setDigits("");
        return;
      }
      if (mode === "create" && pin !== first) {
        setError("PINs didn't match. Try again.");
        setFirst(null);
        setDigits("");
        return;
      }
      setBusy(true);
      const err = await onSubmit(pin);
      setBusy(false);
      setDigits("");
      if (err) setError(err);
    },
    [mode, first, onSubmit],
  );

  // Auto-submit once the last digit lands, after a beat so the dot fills in.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (digits.length !== LENGTH) return;
    const t = setTimeout(() => submitRef.current(digits), 120);
    return () => clearTimeout(t);
  }, [digits]);

  const press = useCallback(
    (key: string) => {
      if (busy) return;
      setError(null);
      if (key === "back") setDigits((d) => d.slice(0, -1));
      else setDigits((d) => (d.length >= LENGTH ? d : d + key));
    },
    [busy],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, press]);

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="text-center">
        <h2 className="text-lg font-semibold">{heading}</h2>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}

        <div className={`my-7 flex justify-center gap-4 ${error ? "animate-shake" : ""}`}>
          {Array.from({ length: LENGTH }, (_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                i < digits.length ? "border-accent bg-accent" : "border-line"
              }`}
            />
          ))}
        </div>

        <p className="h-5 text-sm text-danger" role="alert">
          {busy ? <span className="text-muted">Checking…</span> : error}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((k, i) =>
            k === "" ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => press(k)}
                disabled={busy}
                aria-label={k === "back" ? "Delete" : k}
                className="flex h-14 items-center justify-center rounded-2xl text-xl font-normal text-muted active:bg-accent-soft disabled:opacity-50"
              >
                {k === "back" ? <BackspaceIcon /> : k}
              </button>
            ),
          )}
        </div>
      </div>
    </Sheet>
  );
}
