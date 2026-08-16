import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { toPublicUser } from "@/lib/publicUser";
import { logActivity } from "@/lib/activityLog";

export async function GET() {
  const user = await getCurrentUser();
  if (!hasRole(user, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(users.map(toPublicUser));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, password, role } = await request.json();

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    password.length < 8 ||
    !["ADMIN", "ORDERER", "ORDER_ACCEPTER"].includes(role)
  ) {
    return NextResponse.json(
      { error: "Name, email, a password of 8+ characters, and a valid role are required" },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: await hashPassword(password),
        role,
      },
    });
    await logActivity({
      actor: user,
      action: "USER_CREATED",
      entityType: "User",
      entityId: created.id,
      newValue: { name: created.name, email: created.email, role: created.role },
    });
    return NextResponse.json(toPublicUser(created), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }
}
