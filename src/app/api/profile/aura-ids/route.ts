import { fail, ok, readJson, str } from "@/lib/http";
import { addAuraId, getProfile, removeAuraId, setMainAuraId } from "@/lib/queries";
import { currentUserId } from "@/lib/session";
import { validateHandle } from "@/lib/validate";

// Body: { action: "add" | "remove" | "main", handle }. Returns the updated list.
export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const body = await readJson(req);
  const action = str(body.action);
  const handle = str(body.handle).trim().toLowerCase().replace(/@aura$/, "");

  let error: string | null;
  if (action === "add") error = validateHandle(handle) ?? (await addAuraId(me, handle));
  else if (action === "remove") error = await removeAuraId(me, handle);
  else if (action === "main") error = await setMainAuraId(me, handle);
  else return fail("Unknown action");
  if (error) return fail(error, 400);

  const profile = await getProfile(me);
  return ok({ handle: profile?.handle, auraIds: profile?.auraIds ?? [] });
}
