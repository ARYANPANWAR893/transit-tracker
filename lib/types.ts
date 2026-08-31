export type Role =
  | "ADMIN"
  | "REQUIREMENT_OWNER"
  | "PROCUREMENT_OWNER"
  | "SOURCING_COORDINATOR"
  | "LOADING_COORDINATOR";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  REQUIREMENT_OWNER: "Requirement Owner",
  PROCUREMENT_OWNER: "Procurement Owner",
  SOURCING_COORDINATOR: "Sourcing Coordinator",
  LOADING_COORDINATOR: "Loading Coordinator",
};

/** Only the states a human decides; progress beyond this is derived. */
export type RequirementStatus = "REQUESTED" | "REJECTED" | "WITHDRAWN";

export type FulfilmentStatus =
  | "REJECTED" | "WITHDRAWN" | "REQUESTED" | "PROCUREMENT_CONFIRMED" | "ALLOCATED"
  | "PARTIALLY_SHIPPED" | "FULLY_SHIPPED" | "PARTIALLY_RECEIVED" | "RECEIVED";

export const FULFILMENT_LABELS: Record<FulfilmentStatus, string> = {
  REQUESTED: "Requested",
  PROCUREMENT_CONFIRMED: "Procured",
  ALLOCATED: "Allocated",
  PARTIALLY_SHIPPED: "Partially Shipped",
  FULLY_SHIPPED: "Shipped",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export type ContainerStatus =
  | "CREATED" | "PROCUREMENT" | "READY_FOR_LOADING" | "LOADING" | "LOADED" | "IN_TRANSIT" | "ARRIVED";

export const CONTAINER_STATUS_LABELS: Record<ContainerStatus, string> = {
  CREATED: "Created",
  PROCUREMENT: "Procurement",
  READY_FOR_LOADING: "Ready for Loading",
  LOADING: "Loading",
  LOADED: "Loaded",
  IN_TRANSIT: "In Transit",
  ARRIVED: "Arrived",
};

export type IdentifierType =
  | "KMW" | "KATTYMAO_SKU" | "MA_SKU" | "CHINA_CODE" | "AMAZON_SKU" | "AMAZON_ASIN"
  | "FLIPKART_SKU" | "FLIPKART_ASIN" | "MEESHO_SKU" | "MEESHO_PRODUCT_ID";

export const IDENTIFIER_LABELS: Record<IdentifierType, string> = {
  KMW: "KMW ID",
  KATTYMAO_SKU: "KattyMao SKU",
  MA_SKU: "MA SKU",
  CHINA_CODE: "China Code",
  AMAZON_SKU: "Amazon SKU",
  AMAZON_ASIN: "Amazon ASIN",
  FLIPKART_SKU: "Flipkart SKU",
  FLIPKART_ASIN: "Flipkart ASIN",
  MEESHO_SKU: "Meesho SKU",
  MEESHO_PRODUCT_ID: "Meesho Product ID",
};

export type ContainerUploadStatus = "PROCESSING" | "COMPLETED" | "FAILED";
export type ContainerItemMatchStatus = "MATCHED" | "AMBIGUOUS" | "UNMATCHED" | "ERROR";
export type PhotoSource = "REQUIREMENT_UPLOAD" | "CONTAINER_IMPORT";

export type PublicUser = {
  id: string; name: string; email: string; role: Role; isActive: boolean; createdAt: string;
};

export type PersonRef = { id: string; name: string };

export type ProductFamily = { id: string; name: string; createdAt: string; updatedAt: string };

export type ProductIdentifier = {
  id: string; type: IdentifierType; value: string; normalizedValue: string;
};

export type Product = {
  id: string;
  name: string;
  familyId: string | null;
  family: ProductFamily | null;
  identifiers: ProductIdentifier[];
  createdAt: string;
  updatedAt: string;
};

/** A product a requirement can be raised against, created inline if new. */
export type ProductDraft = {
  name: string;
  familyId: string | null;
  identifiers: { type: IdentifierType; value: string }[];
};

export type ProductSelection = { kind: "existing"; product: Product } | { kind: "new"; draft: ProductDraft };

export type QuantityBreakdown = {
  required: number; procured: number; allocated: number;
  inTransit: number; received: number; outstanding: number;
};

export type Remark = {
  id: string; requirementId: string; body: string;
  authorId: string; author: PersonRef; createdAt: string; updatedAt: string;
};

export type Photo = {
  id: string; requirementId: string; url: string; source: PhotoSource;
  uploadedById: string; uploadedBy: PersonRef; createdAt: string;
};

export type ContainerRef = {
  id: string; code: string; status: ContainerStatus;
  loadingDate: string | null; expectedArrivalDate: string | null;
};

export type Allocation = {
  id: string; qty: number; containerId: string; container: ContainerRef;
  allocatedBy: PersonRef; allocatedAt: string; receivedQty: number;
};

export type Procurement = {
  id: string; qty: number; confirmedBy: PersonRef; confirmedAt: string; notes: string | null;
};

export type ContainerItem = {
  id: string; containerId: string; containerUploadId: string | null;
  rowNumber: number; shippingMark: string | null; itemNo: string | null;
  description: string | null; sectionLabel: string | null;
  cartons: number | null; qtyPerCarton: number | null; totalQty: number | null;
  cbm: number | null; totalCbm: number | null; weight: number | null; totalWeight: number | null;
  imageUrl: string | null;
  matchStatus: ContainerItemMatchStatus; matchNote: string | null;
  resolvedProductId: string | null;
  resolvedProduct: { id: string; name: string } | null;
  reviewedBy: PersonRef | null; reviewedAt: string | null;
  createdAt: string;
  /** Populated only for AMBIGUOUS rows: the products a human can pick from. */
  candidateProducts?: { id: string; name: string; matchedOn: string }[];
};

export type ContainerUpload = {
  id: string; containerId: string; fileName: string; blobUrl: string;
  status: ContainerUploadStatus;
  totalRows: number; matchedCount: number; ambiguousCount: number;
  unmatchedCount: number; errorCount: number;
  uploadedBy: PersonRef; errorMessage: string | null; createdAt: string;
};

export type Container = ContainerRef & {
  notes: string | null;
  createdBy: PersonRef;
  createdAt: string;
  updatedAt: string;
  allocationCount: number;
  totalAllocatedQty: number;
  exceptionCount: number;
};

export type ContainerProductLine = {
  productId: string; productName: string;
  required: number; inContainer: number; remaining: number;
};

export type ContainerDetail = Container & {
  products: ContainerProductLine[];
  items: ContainerItem[];
  uploads: ContainerUpload[];
};

export type RequirementListItem = {
  id: string;
  status: RequirementStatus;
  fulfilmentStatus: FulfilmentStatus;
  productId: string;
  product: Product;
  quantities: QuantityBreakdown;
  requestedDate: string;
  neededByDate: string;
  createdById: string;
  createdBy: PersonRef;
  containers: ContainerRef[];
  remarkCount: number;
  photoCount: number;
};

export type RequirementDetail = Omit<RequirementListItem, "remarkCount" | "photoCount"> & {
  rejectionReason: string | null; rejectedAt: string | null; rejectedBy: PersonRef | null;
  withdrawnAt: string | null; withdrawnBy: PersonRef | null;
  procurements: Procurement[];
  allocations: Allocation[];
  remarks: Remark[];
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
};

export type RequirementListResponse = {
  items: RequirementListItem[]; total: number; page: number; pageSize: number;
};

/** One product's position across every container carrying it. */
export type ProductContainerLine = {
  containerId: string; code: string; qty: number; receivedQty: number;
  loadingDate: string | null; expectedArrivalDate: string | null; status: ContainerStatus;
};

export type ProductDetail = {
  product: Product;
  quantities: QuantityBreakdown;
  containers: ProductContainerLine[];
  requirements: RequirementListItem[];
};

export type ActivityLog = {
  id: string; actorId: string | null; actor: PersonRef | null; actorRole: Role | null;
  action: string; entityType: string; entityId: string | null;
  previousValue: unknown; newValue: unknown; remarks: string | null; createdAt: string;
};
