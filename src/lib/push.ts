import webpush from "web-push";
import { db } from "./db";

export type PushPayload = { title: string; body: string; url: string; tag: string };

let configured = false;

// Returns false when VAPID keys aren't set, so the app still works without push.
function configure() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", publicKey, privateKey);
  configured = true;
  return true;
}

export async function saveSubscription(userId: string, endpoint: string, p256dh: string, auth: string) {
  // A browser can only belong to one account at a time: the latest sign-in wins.
  await db()`
    INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth)
    VALUES (${endpoint}, ${userId}, ${p256dh}, ${auth})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`;
}

export async function deleteSubscription(userId: string, endpoint: string) {
  await db()`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${userId}`;
}

// Sends to every device of the user. Never throws: a failed push must not fail the request.
export async function notifyUser(userId: string, payload: PushPayload) {
  try {
    if (!configure()) return;
    const subs = await db()`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}`;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 24 },
          );
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // 404/410: the browser dropped this subscription.
          if (status === 404 || status === 410) {
            await db()`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
          } else {
            console.error("push failed", status, e);
          }
        }
      }),
    );
  } catch (e) {
    console.error("push failed", e);
  }
}
