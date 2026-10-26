import { db } from "@/lib/db";
import { fail, ok, readJson, str } from "@/lib/http";
import { checkPin } from "@/lib/pin";
import { currentUserId } from "@/lib/session";

// POST rather than GET: the balance is only revealed with a correct PIN.
export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const pinError = await checkPin(me, str((await readJson(req)).pin));
  if (pinError) return fail(pinError, 403);

  const [user] = await db()`SELECT balance FROM users WHERE id = ${me}`;
  return ok({ balance: user.balance });
}
