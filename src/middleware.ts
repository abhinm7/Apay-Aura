import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/token";

const AUTH_PAGES = ["/login", "/signup"];

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = token ? Boolean(await verifyToken(token)) : false;
  const onAuthPage = AUTH_PAGES.includes(req.nextUrl.pathname);

  if (!signedIn && !onAuthPage) return NextResponse.redirect(new URL("/login", req.url));
  if (signedIn && onAuthPage) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
