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

  const [taken] = await db()`
    SELECT EXISTS (SELECT 1 FROM users WHERE phone = ${phone}) AS phone,
           EXISTS (SELECT 1 FROM aura_ids WHERE handle = ${handle}) AS handle`;
  if (taken.phone) return fail("This phone number already has an account", 409, { field: "account" });
  if (taken.handle) return fail("That Aura ID is taken — try another", 409, { field: "handle" });

  const hash = await bcrypt.hash(password, 10);
  try {
    // User and their main Aura ID in one statement: both are created or neither.
    const [user] = await db()`
      WITH u AS (
        INSERT INTO users (name, phone, password_hash, handle)
        VALUES (${name}, ${phone}, ${hash}, ${handle})
        RETURNING id, handle
      )
      INSERT INTO aura_ids (handle, user_id) SELECT handle, id FROM u
      RETURNING user_id AS id`;
    await startSession(user.id);
    return ok();
  } catch (e) {
    // Lost a race with someone signing up the same phone or Aura ID.
    if ((e as { code?: string }).code === "23505") return fail("That phone or Aura ID was just taken", 409);
    throw e;
  }
}
