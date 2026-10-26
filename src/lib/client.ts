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
