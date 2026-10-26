import bcrypt from "bcryptjs";
import { db } from "./db";

const MAX_ATTEMPTS = 5;

// Returns an error message, or null when the PIN is correct.
export async function checkPin(userId: string, pin: string): Promise<string | null> {
  const [u] = await db()`
    SELECT pin_hash, pin_failed, pin_locked_until FROM users WHERE id = ${userId}`;
  if (!u?.pin_hash) return "Set up your Aura PIN first";
  if (u.pin_locked_until && new Date(u.pin_locked_until) > new Date()) {
    return "Too many wrong attempts. Try again in a few minutes.";
  }

  if (await bcrypt.compare(pin, u.pin_hash)) {
    if (u.pin_failed) await db()`UPDATE users SET pin_failed = 0 WHERE id = ${userId}`;
    return null;
  }

  const failed = u.pin_failed + 1;
  if (failed >= MAX_ATTEMPTS) {
    await db()`
      UPDATE users SET pin_failed = 0, pin_locked_until = now() + interval '5 minutes'
      WHERE id = ${userId}`;
    return "Too many wrong attempts. PIN locked for 5 minutes.";
  }
  await db()`UPDATE users SET pin_failed = ${failed} WHERE id = ${userId}`;
  const left = MAX_ATTEMPTS - failed;
  return `Incorrect PIN. ${left} attempt${left === 1 ? "" : "s"} left.`;
}
