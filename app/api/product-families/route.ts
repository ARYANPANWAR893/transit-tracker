import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageCatalog } from "@/lib/permissions";

export async function GET() {
  const families = await prisma.productFamily.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(families);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canManageCatalog(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await request.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const family = await prisma.productFamily.create({ data: { name: name.trim() } });
    return NextResponse.json(family, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A family with that name already exists" }, { status: 409 });
  }
}
