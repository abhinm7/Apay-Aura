import { fail, ok, readJson, str } from "@/lib/http";
import { addFriendship, getUserByHandle, listFriends } from "@/lib/queries";
import { currentUserId } from "@/lib/session";

export async function GET() {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);
  return ok({ friends: await listFriends(me) });
}

export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const friend = await getUserByHandle(str((await readJson(req)).handle));
  if (!friend) return fail("No one with that Aura ID", 404);
  if (friend.id === me) return fail("That's you!");

  await addFriendship(me, friend.id);
  return ok();
}
