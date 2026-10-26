import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { fail, ok, readJson, str } from "@/lib/http";
import { startSession } from "@/lib/session";
import {
  normalizePhone,
  validateHandle,
  validateName,
  validatePassword,
  validatePhone,
} from "@/lib/validate";

export async function POST(req: Request) {
  const body = await readJson(req);
  const name = str(body.name).trim();
  const phone = normalizePhone(str(body.phone));
  const password = str(body.password);
  const handle = str(body.handle).trim().toLowerCase();

  const accountError = validateName(name) ?? validatePhone(phone) ?? validatePassword(password);
  if (accountError) return fail(accountError, 400, { field: "account" });
  const handleError = validateHandle(handle);
  if (handleError) return fail(handleError, 400, { field: "handle" });

  const taken = await db()`SELECT phone, handle FROM users WHERE phone = ${phone} OR handle = ${handle}`;
  if (taken.some((r) => r.phone === phone)) {
    return fail("This phone number already has an account", 409, { field: "account" });
  }
  if (taken.length) return fail("That Aura ID is taken — try another", 409, { field: "handle" });

  const hash = await bcrypt.hash(password, 10);
  const [user] = await db()`
    INSERT INTO users (name, phone, password_hash, handle)
    VALUES (${name}, ${phone}, ${hash}, ${handle})
    RETURNING id`;
  await startSession(user.id);
  return ok();
}
