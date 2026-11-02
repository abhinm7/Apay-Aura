import { cookies } from "next/headers";
import { db } from "./db";
import { signToken, verifyToken } from "./token";

// /admin is unlocked by this PIN alone (no user login). Server-side only: never
// import this file from a client component.
const ADMIN_PIN = "0424";
const ADMIN_COOKIE = "apay_admin";
// Signed as the token subject; user sessions carry a user id there, so neither cookie can stand in for the other.
const ADMIN_SUBJECT = "admin";
const SESSION_HOURS = 12;

const MAX_ATTEMPTS = 5;

// Returns an error message, or null when the PIN is right. Wrong attempts are counted
// across everyone (there's no account to count them on): 5 in a row lock /admin for 5 minutes.
export async function checkAdminPin(pin: string): Promise<string | null> {
  const [lock] = await db()`
    INSERT INTO admin_lock (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET id = 1
    RETURNING failed, locked_until`;
  if (lock.locked_until && new Date(lock.locked_until) > new Date()) {
    return "Too many wrong attempts. Try again in a few minutes.";
  }
  if (pin === ADMIN_PIN) {
    if (lock.failed) await db()`UPDATE admin_lock SET failed = 0 WHERE id = 1`;
    return null;
  }
  const [after] = await db()`
    UPDATE admin_lock SET
      failed = CASE WHEN failed + 1 >= ${MAX_ATTEMPTS} THEN 0 ELSE failed + 1 END,
      locked_until = CASE WHEN failed + 1 >= ${MAX_ATTEMPTS} THEN now() + interval '5 minutes' ELSE locked_until END
    WHERE id = 1 RETURNING failed`;
  if (after.failed === 0) return "Too many wrong attempts. Locked for 5 minutes.";
  const left = MAX_ATTEMPTS - after.failed;
  return `Incorrect PIN. ${left} attempt${left === 1 ? "" : "s"} left.`;
}

export async function startAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, await signToken(ADMIN_SUBJECT, `${SESSION_HOURS}h`), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return token ? (await verifyToken(token)) === ADMIN_SUBJECT : false;
}
