import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { toPublicUser } from "@/lib/publicUser";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!hasRole(currentUser, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};

  if ("role" in body) {
    if (!["ADMIN", "EDITOR", "VIEWER"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (id === currentUser!.id && body.role !== "ADMIN") {
      return NextResponse.json({ error: "You can't demote your own account" }, { status: 400 });
    }
    data.role = body.role;
  }

  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "Invalid isActive" }, { status: 400 });
    }
    if (id === currentUser!.id && body.isActive === false) {
      return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 400 });
    }
    data.isActive = body.isActive;
  }

  if ("password" in body) {
    if (typeof body.password !== "string" || body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    data.passwordHash = await hashPassword(body.password);
  }

  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    data.name = body.name.trim();
  }

  try {
    const updated = await prisma.user.update({ where: { id }, data });
    return NextResponse.json(toPublicUser(updated));
  } catch {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!hasRole(currentUser, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (id === currentUser!.id) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "This user has associated records — deactivate them instead of deleting" },
      { status: 409 }
    );
  }
}
