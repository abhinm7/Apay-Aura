import { fail, ok, readJson, str } from "@/lib/http";
import {
  AMOUNT_STEP,
  MAX_BALANCE_MULTIPLE,
  maxLoan,
  needsVerification,
  VERIFY_ABOVE_AMOUNT,
  VERIFY_ABOVE_MONTHS,
} from "@/lib/loans";
import { applyLoan, getBank, getLoanEligibility, listLoans, settleLoans } from "@/lib/queries";
import { currentUserId } from "@/lib/session";

// Loans brought up to date (approvals, EMIs), plus the 10x-balance borrowing limit.
export async function GET() {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  await settleLoans(me);
  const [loans, user] = await Promise.all([listLoans(me), getLoanEligibility(me)]);
  return ok({ loans, limit: (user?.balance ?? 0) * MAX_BALANCE_MULTIPLE });
}

// Applies for a loan: { bank, amount, pledge }. Approved automatically after a wait.
export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const body = await readJson(req);
  const bank = await getBank(str(body.bank));
  const amount = Number(body.amount);
  if (!bank?.active) return fail("That loan isn't available");
  if (!Number.isInteger(amount) || amount <= 0 || amount % AMOUNT_STEP !== 0) return fail("Choose a loan amount");
  if (body.pledge !== true) return fail("Accept the repayment pledge to apply");

  await settleLoans(me);
  const user = await getLoanEligibility(me);
  if (!user) return fail("Not signed in", 401);
  if (needsVerification(amount, bank.months) && !user.verified) {
    return fail(
      `Loans over ✦ ${VERIFY_ABOVE_AMOUNT.toLocaleString("en-IN")} or longer than ${VERIFY_ABOVE_MONTHS} months need a verified account`,
      403,
    );
  }
  if (amount > maxLoan(bank, user.balance)) {
    return fail(`You can borrow up to ✦ ${bank.upTo.toLocaleString("en-IN")} and at most ${MAX_BALANCE_MULTIPLE}× your balance`);
  }

  const loan = await applyLoan(me, bank, amount);
  if (!loan) return fail(`You already have a loan with ${bank.name}`, 409);
  return ok({ loan });
}
