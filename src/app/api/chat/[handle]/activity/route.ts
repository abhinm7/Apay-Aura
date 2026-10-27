import { fail, ok, readJson, str } from "@/lib/http";
import { getUserByHandle, setActivity, type Activity } from "@/lib/queries";
import { currentUserId } from "@/lib/session";

type Ctx = { params: Promise<{ handle: string }> };

// Body: { kind: "typing" | "paying" | null }. The client re-sends it every few
// seconds while it's happening; null (or silence) clears it.
export async function POST(req: Request, ctx: Ctx) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);
  const friend = await getUserByHandle((await ctx.params).handle);
  if (!friend || friend.id === me) return fail("No one with that Aura ID", 404);

  const kind = str((await readJson(req)).kind);
  await setActivity(me, friend.id, kind === "typing" || kind === "paying" ? (kind as Activity) : null);
  return ok();
}
