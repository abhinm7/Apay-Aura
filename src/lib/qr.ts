import { validateHandle } from "./validate";

// What a receive QR encodes: a link that opens the pay screen for that Aura ID,
// so it also works when scanned with the phone's own camera app.
export const payLink = (origin: string, handle: string) => `${origin}/chat/${handle}?pay=1`;

// Pulls the Aura ID out of a scanned QR: our pay link, "name@aura", or a bare handle.
export function handleFromQr(text: string): string | null {
  const raw = text.trim();
  let handle = raw;
  try {
    const url = new URL(raw);
    const m = url.pathname.match(/^\/chat\/([^/]+)\/?$/);
    if (!m) return null;
    handle = decodeURIComponent(m[1]);
  } catch {
    handle = raw.replace(/@aura$/i, "");
  }
  handle = handle.toLowerCase();
  return validateHandle(handle) ? null : handle;
}
