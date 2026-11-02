import { isAdmin } from "@/lib/admin";
import { fail, ok, readJson } from "@/lib/http";
import { bankInput, validateBank } from "@/lib/loans";
import { createBank } from "@/lib/queries";

// Adds a bank.
export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("Admin PIN required", 401);
  const input = bankInput(await readJson(req));
  const error = validateBank(input);
  if (error) return fail(error);
  return ok({ bank: await createBank(input) });
}
