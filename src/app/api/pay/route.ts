import { after } from "next/server";
import { fail, ok, readJson, str } from "@/lib/http";
import { checkPin } from "@/lib/pin";
import { notifyUser } from "@/lib/push";
import { getUserByHandle, getUserById, transferAura } from "@/lib/queries";
import { currentUserId } from "@/lib/session";

const MAX_AMOUNT = 100_000;

export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const body = await readJson(req);
  const amount = Number(body.amount);
  const note = str(body.note).trim().slice(0, 100);

  if (!Number.isInteger(amount) || amount <= 0) return fail("Enter a whole amount of aura");
  if (amount > MAX_AMOUNT) return fail(`You can send at most ${MAX_AMOUNT.toLocaleString()} aura at once`);

  const friend = await getUserByHandle(str(body.to));
  if (!friend) return fail("No one with that Aura ID", 404);
  if (friend.id === me) return fail("You can't send aura to yourself");

  const pinError = await checkPin(me, str(body.pin));
  if (pinError) return fail(pinError, 403);

  const result = await transferAura(me, friend.id, amount, note);
  if (!result) return fail("Not enough aura for this payment", 402);

  after(async () => {
    const sender = await getUserById(me);
    if (!sender) return;
    await notifyUser(friend.id, {
      title: `You received ✦ ${amount.toLocaleString()}`,
      body: note ? `From ${sender.name} · ${note}` : `From ${sender.name}`,
      url: `/chat/${sender.handle}`,
      tag: `pay-${result.message.id}`,
    });
  });
  return ok(result);
}
