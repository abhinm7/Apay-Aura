import { db } from "@/lib/db";
import { fail, ok, readJson, str } from "@/lib/http";
import { currentUserId } from "@/lib/session";
import { validateName } from "@/lib/validate";

export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const name = str((await readJson(req)).name).trim();
  const error = validateName(name);
  if (error) return fail(error);

  await db()`UPDATE users SET name = ${name} WHERE id = ${me}`;
  return ok({ name });
}
