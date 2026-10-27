import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { fail, ok, readJson, str } from "@/lib/http";
import { currentUserId } from "@/lib/session";
import { validatePassword } from "@/lib/validate";

// Body: { current, next }.
export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const body = await readJson(req);
  const current = str(body.current);
  const next = str(body.next);
  const error = validatePassword(next);
  if (error) return fail(error, 400, { field: "next" });

  const [u] = await db()`SELECT password_hash FROM users WHERE id = ${me}`;
  if (!u || !(await bcrypt.compare(current, u.password_hash))) {
    return fail("Current password is wrong", 403, { field: "current" });
  }

  const hash = await bcrypt.hash(next, 10);
  await db()`UPDATE users SET password_hash = ${hash} WHERE id = ${me}`;
  return ok();
}
