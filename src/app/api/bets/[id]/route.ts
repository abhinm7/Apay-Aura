import { after } from "next/server";
import { forfeit, playMove } from "@/lib/bet";
import { fail, ok, readJson, str } from "@/lib/http";
import { checkPin } from "@/lib/pin";
import { notifyUser } from "@/lib/push";
import { acceptBet, applyToBet, getBet, getUserByHandle, getUserById, settleLoans, withdrawBet } from "@/lib/queries";
import { currentUserId } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

async function resolve(ctx: Ctx) {
  const me = await currentUserId();
  if (!me) return { error: fail("Not signed in", 401) };
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return { error: fail("Game not found", 404) };
  return { me, id };
}

// The game as you see it (polled while playing).
export async function GET(_req: Request, ctx: Ctx) {
  const r = await resolve(ctx);
  if (r.error) return r.error;
  const bet = await getBet(r.me, r.id);
  if (!bet) return fail("Game not found", 404);
  return ok({ bet });
}

// { action: "accept" (with pin) | "decline" | "cancel" | "move" (with cell) | "forfeit" }
export async function POST(req: Request, ctx: Ctx) {
  const r = await resolve(ctx);
  if (r.error) return r.error;
  const { me, id } = r;
  const body = await readJson(req);
  const action = str(body.action);

  let error: string | null = null;
  if (action === "accept") {
    const pinError = await checkPin(me, str(body.pin));
    if (pinError) return fail(pinError, 403);
    await settleLoans(me);
    error = await acceptBet(me, id);
    if (!error) {
      after(async () => {
        const [bet, user] = await Promise.all([getBet(me, id), getUserById(me)]);
        const challenger = bet && (await getUserByHandle(bet.other.handle));
        if (!user || !challenger) return;
        await notifyUser(challenger.id, {
          title: `${user.name} accepted your challenge`,
          body: "Your move! You play X.",
          url: `/bet/${id}`,
          tag: `bet-${id}`,
        });
      });
    }
  } else if (action === "decline" || action === "cancel") {
    if (!(await withdrawBet(me, id, action === "decline" ? "declined" : "cancelled"))) {
      error = "This challenge isn't open anymore";
    }
  } else if (action === "move") {
    error = await applyToBet(me, id, (g) => playMove(g, me, Number(body.cell)));
  } else if (action === "forfeit") {
    error = await applyToBet(me, id, (g) => (g.status === "active" ? forfeit(g, me) : "This game isn't being played"));
  } else {
    return fail("Unknown action");
  }

  const bet = await getBet(me, id);
  if (error) return fail(error, 409, { bet });
  return ok({ bet });
}
