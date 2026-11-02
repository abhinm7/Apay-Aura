import { del, put } from "@vercel/blob";
import { after } from "next/server";

// Server side of square image uploads (profile pictures, bank logos). The browser
// crops and shrinks first (squareImage() in client.ts), so this is generous.
const MAX_BYTES = 512 * 1024;

// Check the file's first bytes, not just the Content-Type header the client sent.
const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/webp": (b) =>
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
};

// Stores the request body (a raw JPEG, PNG or WebP) as a public blob at `<name>-<random>.<ext>`.
// Returns its URL, or an error message.
export async function storeImage(req: Request, name: string): Promise<{ url: string } | { error: string }> {
  const type = req.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!SIGNATURES[type]?.(bytes)) return { error: "That doesn't look like a photo" };
  if (bytes.length > MAX_BYTES) return { error: "That photo is too large" };

  const { url } = await put(`${name}.${type.split("/")[1]}`, Buffer.from(bytes), {
    access: "public",
    contentType: type,
    addRandomSuffix: true,
  });
  return { url };
}

// Deleting a replaced image is cleanup only; never fail the request over it.
export function deleteImageLater(url: string | null | undefined) {
  if (url) after(() => del(url).catch(() => {}));
}
