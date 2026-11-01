import { del, put } from "@vercel/blob";
import { after } from "next/server";
import { fail, ok } from "@/lib/http";
import { setAvatarUrl } from "@/lib/queries";
import { currentUserId } from "@/lib/session";

// The browser crops and shrinks the photo first (~20 KB), so this is generous.
const MAX_BYTES = 512 * 1024;

// Check the file's first bytes, not just the Content-Type header the client sent.
const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/webp": (b) =>
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
};

// Deleting the old file is cleanup only; never fail the request over it.
function deleteLater(url: string | null) {
  if (url) after(() => del(url).catch(() => {}));
}

// Body is the raw image (Content-Type image/webp, image/jpeg or image/png).
export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const type = req.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!SIGNATURES[type]?.(bytes)) return fail("That doesn't look like a photo");
  if (bytes.length > MAX_BYTES) return fail("That photo is too large");

  const ext = type.split("/")[1];
  const { url } = await put(`avatars/${me}.${ext}`, Buffer.from(bytes), {
    access: "public",
    contentType: type,
    addRandomSuffix: true,
  });
  deleteLater(await setAvatarUrl(me, url));
  return ok({ avatarUrl: url });
}

export async function DELETE() {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);
  deleteLater(await setAvatarUrl(me, null));
  return ok({ avatarUrl: null });
}
