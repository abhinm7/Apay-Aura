import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { searchUsers } from "@/lib/queries";
import { currentUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  // Drop the "@aura" suffix and LIKE wildcards from the query.
  const q = (req.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .replace(/@.*$/, "")
    .replace(/[%\\]/g, "")
    .slice(0, 40);
  if (q.length < 2) return ok({ users: [] });

  return ok({ users: await searchUsers(me, q) });
}
