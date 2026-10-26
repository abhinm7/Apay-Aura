import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { fail, ok, readJson, str } from "@/lib/http";
import { currentUserId } from "@/lib/session";
import { validatePin } from "@/lib/validate";

// Creates the Aura PIN. Only allowed once; there's no reset flow yet.
export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const pin = str((await readJson(req)).pin);
  const error = validatePin(pin);
  if (error) return fail(error);

  const hash = await bcrypt.hash(pin, 10);
  const rows = await db()`
    UPDATE users SET pin_hash = ${hash} WHERE id = ${me} AND pin_hash IS NULL RETURNING id`;
  if (!rows.length) return fail("Your Aura PIN is already set", 409);
  return ok();
}
