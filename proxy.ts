import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getUserByToken } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await getUserByToken(token);

  if (pathname === "/setup") {
    if (user) return NextResponse.redirect(new URL("/", request.url));
    const anyUser = await prisma.user.findFirst({ select: { id: true } });
    if (anyUser) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  if (user) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const anyUser = await prisma.user.findFirst({ select: { id: true } });
  if (!anyUser) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!login|setup|api/auth/login|api/auth/setup|_next/static|_next/image|favicon.ico).*)",
  ],
};
