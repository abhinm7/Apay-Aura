"use client";

import jsQR from "jsqr";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { handleFromQr } from "@/lib/qr";
import Sheet from "./Sheet";

// Scan an apay QR with the camera, then open the pay screen for that Aura ID.
export default function ScanSheet({ open, onClose, myHandle }: { open: boolean; onClose: () => void; myHandle: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNotice(null);

    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function tick() {
      if (stopped) return;
      const video = videoRef.current;
      if (video && ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        // Decode a downscaled frame: plenty for a QR and much faster.
        const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          const handle = handleFromQr(code.data);
          if (handle === myHandle) setNotice("That's your own QR code");
          else if (handle) {
            stopped = true;
            router.push(`/chat/${handle}?pay=1`);
            return;
          } else setNotice("This isn't an apay QR code");
        }
      }
      frame = requestAnimationFrame(tick);
    }

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera needs a secure (https) connection in this browser.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        frame = requestAnimationFrame(tick);
      } catch (e) {
        const name = (e as DOMException).name;
        setError(
          name === "NotAllowedError"
            ? "Camera access is blocked. Allow it for this site in your browser settings."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "Couldn't start the camera.",
        );
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, myHandle, router]);

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="text-center">
        <h2 className="text-lg font-semibold">Scan to pay</h2>
        <p className="mt-1 text-sm text-muted">Point your camera at an apay QR code</p>

        <div className="relative mx-auto mt-5 aspect-square w-full max-w-72 overflow-hidden rounded-3xl bg-black">
          {error ? (
            <p className="flex h-full items-center justify-center px-6 text-sm text-white/80">{error}</p>
          ) : (
            <>
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              {/* Viewfinder corners */}
              <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/70" />
            </>
          )}
        </div>

        <p className="mt-4 h-5 text-sm text-muted" role="status">
          {notice}
        </p>
      </div>
    </Sheet>
  );
}
