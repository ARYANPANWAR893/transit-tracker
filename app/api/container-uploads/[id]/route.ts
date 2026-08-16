import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canActOnFulfillment } from "@/lib/permissions";
import { extractCandidateCodes, classifyMatch, normalizeCode } from "@/lib/excelImport";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canActOnFulfillment(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const upload = await prisma.containerUpload.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { id: true, name: true } },
      items: { include: { reviewedBy: { select: { id: true, name: true } } }, orderBy: { rowNumber: "asc" } },
    },
  });
  if (!upload) return NextResponse.json({ error: "Container upload not found" }, { status: 404 });

  // For rows still awaiting a decision, re-derive candidate orders for the picker UI.
  const ambiguousRows = upload.items.filter((i) => i.matchStatus === "AMBIGUOUS");
  const candidatesByItem = new Map<string, string[]>();
  let orderInfoById = new Map<
    string,
    { id: string; productName: string; qty: number; createdByName: string }
  >();

  if (ambiguousRows.length > 0) {
    const acceptedOrders = await prisma.order.findMany({
      where: { status: "ACCEPTED", product: { maSku: { not: null } } },
      include: { product: { select: { name: true, maSku: true } }, createdBy: { select: { name: true } } },
    });
    const pool = acceptedOrders
      .filter((o) => o.product.maSku)
      .map((o) => ({ id: o.id, maSkuNormalized: normalizeCode(o.product.maSku!) }));

    for (const item of ambiguousRows) {
      const candidates = extractCandidateCodes(item);
      const classification = classifyMatch(candidates, pool);
      candidatesByItem.set(item.id, classification.kind === "ambiguous" ? classification.orderIds : []);
    }

    orderInfoById = new Map(
      acceptedOrders.map((o) => [
        o.id,
        { id: o.id, productName: o.product.name, qty: o.acceptedQty ?? o.qty, createdByName: o.createdBy.name },
      ])
    );
  }

  return NextResponse.json({
    id: upload.id,
    containerName: upload.containerName,
    fileName: upload.fileName,
    blobUrl: upload.blobUrl,
    status: upload.status,
    totalRows: upload.totalRows,
    matchedCount: upload.matchedCount,
    ambiguousCount: upload.ambiguousCount,
    unmatchedCount: upload.unmatchedCount,
    errorCount: upload.errorCount,
    uploadedById: upload.uploadedById,
    uploadedBy: upload.uploadedBy,
    errorMessage: upload.errorMessage,
    createdAt: upload.createdAt.toISOString(),
    items: upload.items.map((i) => ({
      id: i.id,
      containerUploadId: i.containerUploadId,
      rowNumber: i.rowNumber,
      shippingMark: i.shippingMark,
      itemNo: i.itemNo,
      description: i.description,
      sectionLabel: i.sectionLabel,
      cartons: i.cartons,
      qtyPerCarton: i.qtyPerCarton,
      totalQty: i.totalQty,
      cbm: i.cbm ? Number(i.cbm) : null,
      totalCbm: i.totalCbm ? Number(i.totalCbm) : null,
      weight: i.weight ? Number(i.weight) : null,
      totalWeight: i.totalWeight ? Number(i.totalWeight) : null,
      imageUrl: i.imageUrl,
      matchStatus: i.matchStatus,
      matchNote: i.matchNote,
      matchedOrderId: i.matchedOrderId,
      reviewedById: i.reviewedById,
      reviewedBy: i.reviewedBy,
      reviewedAt: i.reviewedAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      candidateOrders: candidatesByItem
        .get(i.id)
        ?.map((oid) => orderInfoById.get(oid))
        .filter((v): v is NonNullable<typeof v> => !!v),
    })),
  });
}
