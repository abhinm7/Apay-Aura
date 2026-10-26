import { NextResponse, type NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { endSession } from "@/lib/session";

export async function POST() {
  await endSession();
  return ok();
}

// Used by pages when the session points at a user that no longer exists.
export async function GET(req: NextRequest) {
  await endSession();
  return NextResponse.redirect(new URL("/login", req.url));
}
