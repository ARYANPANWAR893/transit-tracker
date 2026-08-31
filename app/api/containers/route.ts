import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageContainers } from "@/lib/permissions";
import { serializeContainer, CONTAINER_LIST_INCLUDE } from "@/lib/containerSerializer";
import { normalizeCode } from "@/lib/identifiers";
import { expectedArrival } from "@/lib/shipping";
import { logActivity } from "@/lib/activityLog";
import type { ContainerStatus, Prisma } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = request.nextUrl.searchParams;
  const status = p.get("status");
  const search = p.get("search")?.trim();

  const where: Prisma.ContainerWhereInput = {};
  if (status) where.status = status as ContainerStatus;
  if (search) where.code = { contains: normalizeCode(search), mode: "insensitive" };

  const containers = await prisma.container.findMany({
    where, include: CONTAINER_LIST_INCLUDE, orderBy: [{ loadingDate: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(containers.map(serializeContainer));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canManageContainers(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { code, loadingDate, notes } = await request.json();
  if (typeof code !== "string" || !normalizeCode(code)) {
    return NextResponse.json({ error: "Enter a container code" }, { status: 400 });
  }
  if (loadingDate !== undefined && loadingDate !== null && Number.isNaN(Date.parse(loadingDate))) {
    return NextResponse.json({ error: "Invalid loading date" }, { status: 400 });
  }

  // Normalised so "YS 15", "ys-15" and "YS15" can't become three containers.
  const normalized = normalizeCode(code);
  const loading = loadingDate ? new Date(loadingDate) : null;

  try {
    const container = await prisma.container.create({
      data: {
        code: normalized,
        loadingDate: loading,
        expectedArrivalDate: expectedArrival(loading),
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
        createdById: user!.id,
      },
      include: CONTAINER_LIST_INCLUDE,
    });
    await logActivity({
      actor: user, action: "CONTAINER_CREATED", entityType: "Container", entityId: container.id,
      newValue: { code: normalized, loadingDate: loading, expectedArrivalDate: container.expectedArrivalDate },
    });
    return NextResponse.json(serializeContainer(container), { status: 201 });
  } catch {
    return NextResponse.json({ error: `Container ${normalized} already exists` }, { status: 409 });
  }
}
