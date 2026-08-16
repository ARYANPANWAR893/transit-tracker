import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canViewActivityLog } from "@/lib/permissions";
import type { Prisma } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canViewActivityLog(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const action = params.get("action")?.trim();
  const entityType = params.get("entityType")?.trim();
  const actorId = params.get("actorId")?.trim();
  const search = params.get("search")?.trim();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(params.get("pageSize")) || 50));

  const where: Prisma.ActivityLogWhereInput = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (actorId) where.actorId = actorId;
  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { entityType: { contains: search, mode: "insensitive" } },
      { remarks: { contains: search, mode: "insensitive" } },
      { actor: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return NextResponse.json({
    items: logs.map((l) => ({
      id: l.id,
      actorId: l.actorId,
      actor: l.actor,
      actorRole: l.actorRole,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      previousValue: l.previousValue,
      newValue: l.newValue,
      remarks: l.remarks,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });
}
