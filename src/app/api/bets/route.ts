import { after } from "next/server";
import { validateStake } from "@/lib/bet";
import { fail, ok, readJson, str } from "@/lib/http";
import { checkPin } from "@/lib/pin";
import { notifyUser } from "@/lib/push";
import { createBet, getUserByHandle, getUserById, listOpenBets, settleLoans } from "@/lib/queries";
import { currentUserId } from "@/lib/session";

// Your pending and live games.
export async function GET() {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);
  return ok({ bets: await listOpenBets(me) });
}

// Challenges someone: { to, stake, pin }. Takes the stake now; refunded if they decline.
export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const body = await readJson(req);
  const stake = Number(body.stake);
  const stakeError = validateStake(stake);
  if (stakeError) return fail(stakeError);

  const opponent = await getUserByHandle(str(body.to));
  if (!opponent) return fail("No one with that Aura ID", 404);
  if (opponent.id === me) return fail("You can't challenge yourself");

  const pinError = await checkPin(me, str(body.pin));
  if (pinError) return fail(pinError, 403);

  await settleLoans(me);
  const id = await createBet(me, opponent.id, stake);
  if (!id) return fail("Not enough aura for this bet", 402);

  after(async () => {
    const sender = await getUserById(me);
    if (!sender) return;
    await notifyUser(opponent.id, {
      title: `${sender.name} challenged you`,
      body: `Tic-tac-toe for ✦ ${stake.toLocaleString("en-IN")} each. Winner takes ✦ ${(stake * 2).toLocaleString("en-IN")}.`,
      url: `/bet/${id}`,
      tag: `bet-${id}`,
    });
  });
  return ok({ id });
}
