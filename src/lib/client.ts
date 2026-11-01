// Browser-side fetch helper: throws with the server's error message.
export async function api<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/auth/")) window.location.href = "/login";
  if (!res.ok) throw new ApiError(data.error ?? "Something went wrong", data);
  return data as T;
}

export class ApiError extends Error {
  constructor(message: string, public data: Record<string, unknown>) {
    super(message);
  }
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

// Center-crops an image file to a square and shrinks it for upload as a profile picture.
// WebP where the browser can encode it, JPEG otherwise.
export async function squareImage(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't read that photo. Try a JPG or PNG.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(size, side);
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  const webp = await encode("image/webp");
  const blob = webp?.type === "image/webp" ? webp : await encode("image/jpeg");
  if (!blob) throw new Error("Couldn't process that photo");
  return blob;
}

// Crops, shrinks and uploads a new profile picture; returns its URL.
export async function uploadAvatar(file: File): Promise<string> {
  const image = await squareImage(file);
  const res = await fetch("/api/profile/avatar", { method: "POST", headers: { "Content-Type": image.type }, body: image });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Couldn't upload that photo");
  return data.avatarUrl;
}
