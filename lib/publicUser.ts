import type { User } from "@/app/generated/prisma/client";
import type { PublicUser } from "@/lib/types";

/** Strips sensitive fields (passwordHash) before a User ever reaches the client. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
