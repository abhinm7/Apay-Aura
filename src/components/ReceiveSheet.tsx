"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { payLink } from "@/lib/qr";
import { auraId } from "@/lib/validate";
import Sheet from "./Sheet";
import VerifiedName from "./VerifiedName";

export default function ReceiveSheet({
  open,
  onClose,
  name,
  handle,
  verified,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  handle: string;
  verified: boolean;
}) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || qr) return;
    QRCode.toDataURL(payLink(window.location.origin, handle), { width: 512, margin: 1, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [open, qr, handle]);

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="text-center">
        <h2 className="text-lg font-semibold">Receive aura</h2>

        {/* Always dark-on-white so any camera can read it, even in dark mode. */}
        <div className="mx-auto mt-5 aspect-square w-full max-w-72 rounded-3xl bg-white p-4">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code for ${auraId(handle)}`} className="h-full w-full" />
          )}
        </div>

        <VerifiedName name={name} verified={verified} className="mt-4 justify-center text-base font-semibold" />
        <p className="text-sm text-muted">{auraId(handle)}</p>
        <p className="mx-auto mt-4 max-w-64 text-sm text-muted">
          Scan this QR with apay to send aura to you.
        </p>
      </div>
    </Sheet>
  );
}
