export type Role = "ADMIN" | "ORDERER" | "ORDER_ACCEPTER";

export type OrderStatus =
  | "DRAFT"
  | "REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "IN_TRANSIT"
  | "ARRIVED"
  | "CONFIRMED_RECEIVED";

export type ConversionKind = "REQUEST" | "ACCEPTANCE";
export type ContainerUploadStatus = "PROCESSING" | "COMPLETED" | "FAILED";
export type ContainerItemMatchStatus = "MATCHED" | "AMBIGUOUS" | "UNMATCHED" | "ERROR";
export type PhotoSource = "ORDERER_UPLOAD" | "CONTAINER_IMPORT";

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

/** All six identifiers are optional individually; at least one is required overall (enforced server-side). */
export type Product = {
  id: string;
  name: string;
  amazonSku: string | null;
  amazonAsin: string | null;
  flipkartSku: string | null;
  flipkartAsin: string | null;
  meeshoSku: string | null;
  meeshoProductId: string | null;
  maSku: string | null;
  kmwId: string | null;
  familyId: string | null;
  family: ProductFamily | null;
  createdAt: string;
  updatedAt: string;
};

/** A product identification draft the Orderer can create inline while placing an order. */
export type ProductDraft = {
  name: string;
  amazonSku: string | null;
  amazonAsin: string | null;
  flipkartSku: string | null;
  flipkartAsin: string | null;
  meeshoSku: string | null;
  meeshoProductId: string | null;
  maSku: string | null;
  kmwId: string | null;
  familyId: string | null;
};

export type ProductSelection = { kind: "existing"; product: Product } | { kind: "new"; draft: ProductDraft };

export type PersonRef = { id: string; name: string };

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
  source: PhotoSource;
  uploadedById: string;
  uploadedBy: PersonRef;
  createdAt: string;
};

export type CurrencyConversion = {
  id: string;
  orderId: string;
  kind: ConversionKind;
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  convertedCurrency: string;
  rate: number;
  rateTimestamp: string;
  createdAt: string;
};

export type ContainerItem = {
  id: string;
  containerUploadId: string;
  rowNumber: number;
  shippingMark: string | null;
  itemNo: string | null;
  description: string | null;
  sectionLabel: string | null;
  cartons: number | null;
  qtyPerCarton: number | null;
  totalQty: number | null;
  cbm: number | null;
  totalCbm: number | null;
  weight: number | null;
  totalWeight: number | null;
  imageUrl: string | null;
  matchStatus: ContainerItemMatchStatus;
  matchNote: string | null;
  matchedOrderId: string | null;
  reviewedById: string | null;
  reviewedBy: PersonRef | null;
  reviewedAt: string | null;
  createdAt: string;
  /** Populated only for AMBIGUOUS rows: orders the Accepter can pick from. */
  candidateOrders?: { id: string; productName: string; qty: number; createdByName: string }[];
};

export type ContainerUpload = {
  id: string;
  containerName: string;
  fileName: string;
  blobUrl: string;
  status: ContainerUploadStatus;
  totalRows: number;
  matchedCount: number;
  ambiguousCount: number;
  unmatchedCount: number;
  errorCount: number;
  uploadedById: string;
  uploadedBy: PersonRef;
  errorMessage: string | null;
  createdAt: string;
};

export type ContainerUploadDetail = ContainerUpload & { items: ContainerItem[] };

export type ActivityLog = {
  id: string;
  actorId: string | null;
  actor: PersonRef | null;
  actorRole: Role | null;
  action: string;
  entityType: string;
  entityId: string | null;
  previousValue: unknown;
  newValue: unknown;
  remarks: string | null;
  createdAt: string;
};

/** Full order detail, including relations — used by the order detail drawer. */
export type OrderDetail = {
  id: string;
  status: OrderStatus;
  productId: string;
  product: Product;

  qty: number;
  requestedPriceInr: number | null;
  requestedPriceCny: number | null;
  requestedDate: string;
  neededByDate: string;

  createdById: string;
  createdBy: PersonRef;

  acceptedQty: number | null;
  acceptedPriceCny: number | null;
  acceptedPriceInr: number | null;
  acceptedExpectedArrivalDate: string | null;
  acceptanceDate: string | null;
  acceptedById: string | null;
  acceptedBy: PersonRef | null;

  rejectionReason: string | null;
  rejectedAt: string | null;
  rejectedById: string | null;
  rejectedBy: PersonRef | null;

  withdrawnAt: string | null;
  withdrawnById: string | null;
  withdrawnBy: PersonRef | null;

  arrivedAt: string | null;
  arrivedById: string | null;
  arrivedBy: PersonRef | null;

  confirmedReceivedAt: string | null;
  confirmedById: string | null;
  confirmedBy: PersonRef | null;

  remarks: Remark[];
  photos: Photo[];
  conversions: CurrencyConversion[];
  containerItems: ContainerItem[];

  createdAt: string;
  updatedAt: string;
};

/** Lighter shape returned by the list endpoint. */
export type OrderListItem = Omit<OrderDetail, "remarks" | "photos" | "conversions" | "containerItems"> & {
  remarkCount: number;
  photoCount: number;
  containerName: string | null;
};

export type OrderListResponse = {
  items: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
};
