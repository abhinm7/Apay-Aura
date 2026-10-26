import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { fail, ok, readJson, str } from "@/lib/http";
import { startSession } from "@/lib/session";
import { normalizePhone } from "@/lib/validate";

export async function POST(req: Request) {
  const body = await readJson(req);
  const phone = normalizePhone(str(body.phone));
  const password = str(body.password);

  const [user] = await db()`SELECT id, password_hash FROM users WHERE phone = ${phone}`;
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return fail("Wrong phone number or password", 401);
  }
  await startSession(user.id);
  return ok();
}
