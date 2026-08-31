import type { RequirementStatus, Role } from "@/lib/types";

type ActorLike = { id: string; role: Role } | null;
type RequirementLike = { status: RequirementStatus; createdById: string };

export function isAdmin(user: ActorLike): boolean {
  return user?.role === "ADMIN";
}

const has = (user: ActorLike, ...roles: Role[]): boolean =>
  !!user && (user.role === "ADMIN" || roles.includes(user.role));

/* ---------------------------------------------------------------- demand */

export function canCreateRequirement(user: ActorLike): boolean {
  return has(user, "REQUIREMENT_OWNER");
}

/** Alice only ever works from container tasks, so she has no requirement view. */
export function canViewRequirements(user: ActorLike): boolean {
  return has(user, "REQUIREMENT_OWNER", "PROCUREMENT_OWNER", "SOURCING_COORDINATOR");
}

export function canViewRequirement(user: ActorLike, requirement: RequirementLike): boolean {
  if (!user) return false;
  if (has(user, "PROCUREMENT_OWNER", "SOURCING_COORDINATOR")) return true;
  return user.role === "REQUIREMENT_OWNER" && requirement.createdById === user.id;
}

// Admin acts on anyone's requirement, but still only from the state where the
// action is the natural next step. Arbitrary state changes belong to the
// separate, explicitly-logged override path -- not to hijacking these controls.
export function canWithdrawRequirement(user: ActorLike, requirement: RequirementLike): boolean {
  if (!user || requirement.status !== "REQUESTED") return false;
  return user.role === "ADMIN" || (user.role === "REQUIREMENT_OWNER" && requirement.createdById === user.id);
}

export function canRejectRequirement(user: ActorLike, requirement: RequirementLike): boolean {
  if (requirement.status !== "REQUESTED") return false;
  return has(user, "PROCUREMENT_OWNER");
}

/* ----------------------------------------------------------- procurement */

export function canConfirmProcurement(user: ActorLike): boolean {
  return has(user, "PROCUREMENT_OWNER");
}

export function canAllocate(user: ActorLike): boolean {
  return has(user, "PROCUREMENT_OWNER");
}

/* -------------------------------------------------------------- shipping */

export function canManageContainers(user: ActorLike): boolean {
  return has(user, "PROCUREMENT_OWNER", "SOURCING_COORDINATOR");
}

export function canUploadManifest(user: ActorLike): boolean {
  return has(user, "SOURCING_COORDINATOR");
}

export function canResolveManifestExceptions(user: ActorLike): boolean {
  return has(user, "SOURCING_COORDINATOR");
}

export function canConfirmLoading(user: ActorLike): boolean {
  return has(user, "LOADING_COORDINATOR");
}

/* --------------------------------------------------------------- receipt */

export function canConfirmReceipt(user: ActorLike, requirement: RequirementLike): boolean {
  if (!user || requirement.status !== "REQUESTED") return false;
  return user.role === "ADMIN" || (user.role === "REQUIREMENT_OWNER" && requirement.createdById === user.id);
}

/* ----------------------------------------------------------------- admin */

export function canManageUsers(user: ActorLike): boolean {
  return isAdmin(user);
}

export function canManageCatalog(user: ActorLike): boolean {
  return has(user, "PROCUREMENT_OWNER", "SOURCING_COORDINATOR");
}

export function canViewActivityLog(user: ActorLike): boolean {
  return isAdmin(user);
}

export function canAdminOverride(user: ActorLike): boolean {
  return isAdmin(user);
}

export function canCommentOnRequirement(user: ActorLike, requirement: RequirementLike): boolean {
  if (!user) return false;
  if (has(user, "PROCUREMENT_OWNER", "SOURCING_COORDINATOR")) return true;
  return user.role === "REQUIREMENT_OWNER" && requirement.createdById === user.id;
}
