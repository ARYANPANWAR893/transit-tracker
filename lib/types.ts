export type Role = "ADMIN" | "EDITOR" | "VIEWER";
export type OrderStatus = "REQUESTED" | "ACCEPTED" | "PARTIALLY_ARRIVED" | "ARRIVED";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

export type ProductFamily = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  maSku: string;
  kmSku: string;
  familyId: string | null;
  family: ProductFamily | null;
  createdAt: string;
  updatedAt: string;
};

export type PersonRef = { id: string; name: string };

/** What the New Order product picker can produce: pick an existing product, or draft a new one inline. */
export type ProductSelection =
  | { kind: "existing"; product: Product }
  | { kind: "new"; name: string; maSku: string; kmSku: string; familyId: string | null };

export type OrderArrival = {
  id: string;
  orderId: string;
  qty: number;
  arrivedDate: string;
  containerNumber: string | null;
  recordedById: string;
  recordedBy: PersonRef;
  createdAt: string;
};

export type Remark = {
  id: string;
  orderId: string;
  body: string;
  authorId: string;
  author: PersonRef;
  createdAt: string;
  updatedAt: string;
};

export type Photo = {
  id: string;
  orderId: string;
  url: string;
  uploadedById: string;
  uploadedBy: PersonRef;
  createdAt: string;
};

/** Full order detail, including relations — used by the order detail drawer. */
export type OrderDetail = {
  id: string;
  status: OrderStatus;
  productId: string;
  product: Product;
  qty: number;
  requestedDate: string;
  neededByDate: string;
  acceptanceDate: string | null;
  containerNumber: string | null;
  estArrivalDate: string | null;
  createdById: string;
  createdBy: PersonRef;
  arrivals: OrderArrival[];
  remarks: Remark[];
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
  qtyReceived: number;
  finalArrivedDate: string | null;
};

/** Lighter shape returned by the list endpoint (no remarks/photos payload, just counts). */
export type OrderListItem = Omit<OrderDetail, "remarks" | "photos" | "arrivals"> & {
  remarkCount: number;
  photoCount: number;
};

export type OrderListResponse = {
  items: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
};
