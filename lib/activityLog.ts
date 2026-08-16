import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import type { Role } from "@/lib/types";

export type ActivityActor = { id: string; role: Role } | null;

/**
 * Backend-enforced audit trail. Called directly from route handlers (not
 * dependent on any frontend event) for every meaningful mutation: order
 * lifecycle transitions, container upload/matching, user/product changes,
 * admin overrides.
 */
export async function logActivity(params: {
  actor: ActivityActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  remarks?: string | null;
}): Promise<void> {
  await prisma.activityLog.create({
    data: {
      actorId: params.actor?.id ?? null,
      actorRole: params.actor?.role ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      previousValue:
        params.previousValue === undefined ? undefined : (params.previousValue as Prisma.InputJsonValue),
      newValue: params.newValue === undefined ? undefined : (params.newValue as Prisma.InputJsonValue),
      remarks: params.remarks ?? null,
    },
  });
}
