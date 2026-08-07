import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, createSession } from "@/lib/session";
import { toPublicUser } from "@/lib/publicUser";

export async function POST(request: NextRequest) {
  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    return NextResponse.json({ error: "Setup has already been completed" }, { status: 403 });
  }

  const { name, email, password } = await request.json();

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    return NextResponse.json(
      { error: "Name, email, and a password of at least 8 characters are required" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: "ADMIN",
    },
  });

  const token = await createSession(user.id);
  const response = NextResponse.json({ ok: true, user: toPublicUser(user) });
  response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  return response;
}
