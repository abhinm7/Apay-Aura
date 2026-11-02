import { fail, ok, readJson, str } from "@/lib/http";
import { checkPin } from "@/lib/pin";
import { approveLoanNow, listLoans, settleLoans } from "@/lib/queries";
import { currentUserId } from "@/lib/session";

// Approves a pending loan straight away for the instant-approval fee: { pin }.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const { id } = await params;
  if (!/^\d+$/.test(id)) return fail("Loan not found", 404);

  const pinError = await checkPin(me, str((await readJson(req)).pin));
  if (pinError) return fail(pinError, 403);

  await settleLoans(me);
  const error = await approveLoanNow(me, id);
  if (error) return fail(error, 402);
  return ok({ loans: await listLoans(me) });
}
