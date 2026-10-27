import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { fail, ok, readJson, str } from "@/lib/http";
import { checkPin } from "@/lib/pin";
import { currentUserId } from "@/lib/session";
import { validatePin } from "@/lib/validate";

// Body: { current, next }. The current PIN goes through checkPin, so wrong
// guesses count toward the same 5-try lock as payments. Sending only
// { current } just verifies it (the UI checks it before asking for the new PIN).
export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const body = await readJson(req);
  const current = str(body.current);
  const next = str(body.next);

  const pinError = await checkPin(me, current);
  if (pinError) return fail(pinError, 403, { field: "current" });
  if (!next) return ok({ verified: true });
  const error = validatePin(next);
  if (error) return fail(error, 400, { field: "next" });
  if (next === current) return fail("New PIN must be different", 400, { field: "next" });

  const hash = await bcrypt.hash(next, 10);
  await db()`UPDATE users SET pin_hash = ${hash} WHERE id = ${me}`;
  return ok();
}
