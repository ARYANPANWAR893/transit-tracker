import type { OrderStatus, Role } from "@/lib/types";

type ActorLike = { id: string; role: Role } | null;

type OrderLike = { status: OrderStatus; createdById: string };

export function isAdmin(user: ActorLike): boolean {
  return user?.role === "ADMIN";
}

export function isOrderAccepter(user: ActorLike): boolean {
  return user?.role === "ORDER_ACCEPTER" || user?.role === "ADMIN";
}

export function isOrderer(user: ActorLike): boolean {
  return user?.role === "ORDERER" || user?.role === "ADMIN";
}

/** Create/withdraw/confirm-receipt on their own orders; Admin can do this for anyone. */
export function canCreateOrder(user: ActorLike): boolean {
  return !!user && (user.role === "ORDERER" || user.role === "ADMIN");
}

export function canViewOrder(user: ActorLike, order: OrderLike): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "ORDER_ACCEPTER") return true;
  return order.createdById === user.id;
}

// Note: these two intentionally do NOT give Admin an unconditional bypass.
// Admin can act on anyone's order, but only at the state where that action
// is the natural next step -- same as the role it's standing in for. Arbitrary
// state changes belong to the separate, explicitly-logged canAdminOverride
// path (PATCH /api/orders/[id]), not to hijacking these lifecycle buttons.
export function canWithdrawOrder(user: ActorLike, order: OrderLike): boolean {
  if (!user || order.status !== "REQUESTED") return false;
  return user.role === "ADMIN" || (user.role === "ORDERER" && order.createdById === user.id);
}

export function canConfirmReceipt(user: ActorLike, order: OrderLike): boolean {
  if (!user || order.status !== "ARRIVED") return false;
  return user.role === "ADMIN" || (user.role === "ORDERER" && order.createdById === user.id);
}

/** Accept / reject / mark-arrived / upload containers / resolve matches. */
export function canActOnFulfillment(user: ActorLike): boolean {
  return !!user && (user.role === "ORDER_ACCEPTER" || user.role === "ADMIN");
}

export function canManageUsers(user: ActorLike): boolean {
  return isAdmin(user);
}

export function canManageCatalog(user: ActorLike): boolean {
  // Product/family master data can be edited by whoever handles fulfillment, plus Admin.
  return canActOnFulfillment(user);
}

export function canViewActivityLog(user: ActorLike): boolean {
  return isAdmin(user);
}

export function canAdminOverride(user: ActorLike): boolean {
  return isAdmin(user);
}

/** Remarks/photos: order owner, whoever handles fulfillment, or Admin. */
export function canCommentOnOrder(user: ActorLike, order: OrderLike): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "ORDER_ACCEPTER") return true;
  return user.role === "ORDERER" && order.createdById === user.id;
}
