import { fail, ok, readJson, str } from "@/lib/http";
import { deleteSubscription, saveSubscription } from "@/lib/push";
import { currentUserId } from "@/lib/session";

// Body: a PushSubscription's JSON ({ endpoint, keys: { p256dh, auth } }).
export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const body = await readJson(req);
  const endpoint = str(body.endpoint);
  const keys = (body.keys ?? {}) as Record<string, unknown>;
  const p256dh = str(keys.p256dh);
  const auth = str(keys.auth);
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return fail("Invalid subscription");

  await saveSubscription(me, endpoint, p256dh, auth);
  return ok();
}

// Body: { endpoint }. Called on sign-out so this device stops getting this user's pushes.
export async function DELETE(req: Request) {
  const me = await currentUserId();
  if (!me) return ok();
  const endpoint = str((await readJson(req)).endpoint);
  if (endpoint) await deleteSubscription(me, endpoint);
  return ok();
}
