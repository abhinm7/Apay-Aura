import { fail, ok, readJson, str } from "@/lib/http";
import { checkPin } from "@/lib/pin";
import { buyVerification, settleLoans } from "@/lib/queries";
import { currentUserId } from "@/lib/session";
import { isOccupation, MAX_ADDRESS, MAX_INCOME } from "@/lib/verification";

// Buys the verified badge: { address, occupation, monthlyIncome, pin }.
export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const body = await readJson(req);
  const address = str(body.address).trim().replace(/\s+/g, " ");
  const occupation = str(body.occupation);
  const monthlyIncome = Number(body.monthlyIncome);

  if (address.length < 10) return fail("Enter your full address");
  if (address.length > MAX_ADDRESS) return fail("That address is too long");
  if (!isOccupation(occupation)) return fail("Choose what you do");
  if (!Number.isInteger(monthlyIncome) || monthlyIncome < 0 || monthlyIncome > MAX_INCOME) {
    return fail("Enter your monthly income as a whole number");
  }

  const pinError = await checkPin(me, str(body.pin));
  if (pinError) return fail(pinError, 403);

  await settleLoans(me);
  const error = await buyVerification(me, { address, occupation, monthlyIncome });
  if (error) return fail(error, 402);
  return ok({ verified: true });
}
