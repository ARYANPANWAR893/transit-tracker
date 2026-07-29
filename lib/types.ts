export type ShipmentStatus = "REQUESTED" | "ACCEPTED" | "ARRIVED";

export type Shipment = {
  id: string;
  status: ShipmentStatus;
  productName: string;
  sku: string;
  asin: string;
  qty: number;
  requestedDate: string;
  neededByDate: string;
  acceptanceDate: string | null;
  containerNumber: string | null;
  estArrivalDate: string | null;
  finalArrivedDate: string | null;
  createdAt: string;
  updatedAt: string;
};
