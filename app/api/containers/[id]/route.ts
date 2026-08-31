import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canConfirmLoading, canManageContainers, isAdmin } from "@/lib/permissions";
import { serializeContainerDetail, CONTAINER_DETAIL_INCLUDE } from "@/lib/containerSerializer";
import { expectedArrival } from "@/lib/shipping";
import { logActivity } from "@/lib/activityLog";
import type { ContainerStatus } from "@/app/generated/prisma/client";

const ORDER: ContainerStatus[] = [
  "CREATED", "PROCUREMENT", "READY_FOR_LOADING", "LOADING", "LOADED", "IN_TRANSIT", "ARRIVED",
];

export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const container = await prisma.container.findUnique({ where: { id }, include: CONTAINER_DETAIL_INCLUDE });
  if (!container) return NextResponse.json({ error: "Container not found" }, { status: 404 });

  return NextResponse.json(serializeContainerDetail(container));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.container.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Container not found" }, { status: 404 });

  const body = await request.json();
  const data: Record<string, unknown> = {};
  let action = "CONTAINER_UPDATED";

  if ("status" in body) {
    if (!ORDER.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    // Confirming loading is Alice's job; the rest of the sequence is shipping's.
    const isLoadingConfirmation = existing.status === "LOADING" && body.status === "LOADED";
    const allowed = isLoadingConfirmation
      ? canConfirmLoading(user) || canManageContainers(user)
      : canManageContainers(user);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Only Admin may move a container backwards through the sequence.
    if (ORDER.indexOf(body.status) < ORDER.indexOf(existing.status) && !isAdmin(user)) {
      return NextResponse.json({ error: "A container can't move backwards" }, { status: 409 });
    }
    data.status = body.status;
    action = isLoadingConfirmation ? "LOADING_CONFIRMED" : "CONTAINER_STATUS_CHANGED";
  }

  if ("loadingDate" in body) {
    if (!canManageContainers(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (body.loadingDate !== null && Number.isNaN(Date.parse(body.loadingDate))) {
      return NextResponse.json({ error: "Invalid loading date" }, { status: 400 });
    }
    const loading = body.loadingDate ? new Date(body.loadingDate) : null;
    data.loadingDate = loading;
    // ETA is always derived, never typed in by a user.
    data.expectedArrivalDate = expectedArrival(loading);
  }

  if ("notes" in body) {
    if (!canManageContainers(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  const updated = await prisma.container.update({ where: { id }, data, include: CONTAINER_DETAIL_INCLUDE });
  await logActivity({
    actor: user, action, entityType: "Container", entityId: id,
    previousValue: { status: existing.status, loadingDate: existing.loadingDate },
    newValue: data,
  });

  return NextResponse.json(serializeContainerDetail(updated));
}
