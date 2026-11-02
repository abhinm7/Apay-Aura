import { isAdmin } from "@/lib/admin";
import { fail, ok, readJson } from "@/lib/http";
import { bankInput, validateBank } from "@/lib/loans";
import { updateBank } from "@/lib/queries";

// Updates a bank. Existing loans keep the terms they were taken on.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return fail("Admin PIN required", 401);
  const input = bankInput(await readJson(req));
  const error = validateBank(input);
  if (error) return fail(error);
  const bank = await updateBank((await params).id, input);
  if (!bank) return fail("Bank not found", 404);
  return ok({ bank });
}
