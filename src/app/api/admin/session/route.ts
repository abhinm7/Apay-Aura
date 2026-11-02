import { checkAdminPin, endAdminSession, startAdminSession } from "@/lib/admin";
import { fail, ok, readJson, str } from "@/lib/http";

// Unlocks /admin: { pin }.
export async function POST(req: Request) {
  const error = await checkAdminPin(str((await readJson(req)).pin));
  if (error) return fail(error, 403);
  await startAdminSession();
  return ok();
}

// Locks /admin again.
export async function DELETE() {
  await endAdminSession();
  return ok();
}
