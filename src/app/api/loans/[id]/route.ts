import { fail, ok } from "@/lib/http";
import { cancelLoan, listLoans, settleLoans } from "@/lib/queries";
import { currentUserId } from "@/lib/session";

// Cancels a pending loan. Settles first, so a loan whose wait is over gets approved instead.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const { id } = await params;
  if (!/^\d+$/.test(id)) return fail("Loan not found", 404);

  await settleLoans(me);
  const cancelled = await cancelLoan(me, id);
  const loans = await listLoans(me);
  if (!cancelled) return fail("This loan can't be cancelled anymore", 409, { loans });
  return ok({ loans });
}
