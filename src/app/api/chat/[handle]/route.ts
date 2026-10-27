import { after, type NextRequest } from "next/server";
import { fail, ok, readJson, str } from "@/lib/http";
import { notifyUser } from "@/lib/push";
import {
  addFriendship,
  getActivity,
  getUserByHandle,
  getUserById,
  insertTextMessage,
  listMessages,
  markRead,
  setActivity,
} from "@/lib/queries";
import { currentUserId } from "@/lib/session";

type Ctx = { params: Promise<{ handle: string }> };

async function resolve(ctx: Ctx) {
  const me = await currentUserId();
  if (!me) return { error: fail("Not signed in", 401) };
  const friend = await getUserByHandle((await ctx.params).handle);
  if (!friend || friend.id === me) return { error: fail("No one with that Aura ID", 404) };
  return { me, friend };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const r = await resolve(ctx);
  if (r.error) return r.error;

  const after = req.nextUrl.searchParams.get("after");
  const afterId = after && /^\d+$/.test(after) ? after : undefined;
  const [messages, activity] = await Promise.all([
    listMessages(r.me, r.friend.id, afterId),
    getActivity(r.friend.id, r.me),
  ]);
  // The chat is open, so anything new from them is now read.
  if (messages.some((m) => !m.mine)) await markRead(r.me, r.friend.id);
  return ok({ messages, activity });
}

export async function POST(req: Request, ctx: Ctx) {
  const r = await resolve(ctx);
  if (r.error) return r.error;

  const text = str((await readJson(req)).text).trim();
  if (!text) return fail("Message is empty");
  if (text.length > 1000) return fail("Message is too long");

  const message = await insertTextMessage(r.me, r.friend.id, text);
  await Promise.all([addFriendship(r.me, r.friend.id), setActivity(r.me, r.friend.id, null)]);

  const friendId = r.friend.id;
  after(async () => {
    const sender = await getUserById(r.me);
    if (!sender) return;
    await notifyUser(friendId, {
      title: sender.name,
      body: text.length > 120 ? `${text.slice(0, 120)}…` : text,
      url: `/chat/${sender.handle}`,
      tag: `chat-${sender.handle}`,
    });
  });
  return ok({ message });
}
