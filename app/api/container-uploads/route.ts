import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canActOnFulfillment } from "@/lib/permissions";
import { logActivity } from "@/lib/activityLog";
import { uploadBlob, BlobNotConfiguredError } from "@/lib/blob";
import { parseContainerExcel, extractCandidateCodes, classifyMatch, normalizeCode } from "@/lib/excelImport";

export const maxDuration = 60;

export async function GET() {
  const user = await getCurrentUser();
  if (!canActOnFulfillment(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const uploads = await prisma.containerUpload.findMany({
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    uploads.map((u) => ({
      id: u.id,
      containerName: u.containerName,
      fileName: u.fileName,
      blobUrl: u.blobUrl,
      status: u.status,
      totalRows: u.totalRows,
      matchedCount: u.matchedCount,
      ambiguousCount: u.ambiguousCount,
      unmatchedCount: u.unmatchedCount,
      errorCount: u.errorCount,
      uploadedById: u.uploadedById,
      uploadedBy: u.uploadedBy,
      errorMessage: u.errorMessage,
      createdAt: u.createdAt.toISOString(),
    }))
  );
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canActOnFulfillment(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fail fast: without a Blob token every row's image upload would throw, and
  // the run would finish "successfully" with an error against all ~100 rows.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: new BlobNotConfiguredError().message }, { status: 503 });
  }

  const { containerName, blobUrl, fileName } = await request.json();

  if (
    typeof containerName !== "string" ||
    !containerName.trim() ||
    typeof blobUrl !== "string" ||
    !blobUrl ||
    typeof fileName !== "string" ||
    !fileName
  ) {
    return NextResponse.json({ error: "containerName, blobUrl, and fileName are required" }, { status: 400 });
  }

  const upload = await prisma.containerUpload.create({
    data: { containerName: containerName.trim(), fileName, blobUrl, uploadedById: user!.id, status: "PROCESSING" },
  });

  await logActivity({
    actor: user,
    action: "CONTAINER_UPLOADED",
    entityType: "ContainerUpload",
    entityId: upload.id,
    newValue: { containerName: containerName.trim(), fileName },
  });

  try {
    const fileRes = await fetch(blobUrl);
    if (!fileRes.ok) throw new Error(`Failed to fetch uploaded file (HTTP ${fileRes.status})`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    const rows = await parseContainerExcel(buffer);

    // Only orders that have been accepted (and have a MASKU to match on) are
    // eligible -- a request that hasn't even been accepted shouldn't silently
    // jump straight to "in transit".
    const acceptedOrders = await prisma.order.findMany({
      where: { status: "ACCEPTED", product: { maSku: { not: null } } },
      include: { product: { select: { id: true, name: true, maSku: true } }, createdBy: { select: { name: true } } },
    });
    const candidatePool = acceptedOrders
      .filter((o) => o.product.maSku)
      .map((o) => ({ id: o.id, maSkuNormalized: normalizeCode(o.product.maSku!) }));

    let matchedCount = 0;
    let ambiguousCount = 0;
    let unmatchedCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      const baseData = {
        containerUploadId: upload.id,
        rowNumber: row.rowNumber,
        shippingMark: row.shippingMark,
        itemNo: row.itemNo,
        description: row.description,
        sectionLabel: row.sectionLabel,
        cartons: row.cartons,
        qtyPerCarton: row.qtyPerCarton,
        totalQty: row.totalQty,
        cbm: row.cbm,
        totalCbm: row.totalCbm,
        weight: row.weight,
        totalWeight: row.totalWeight,
      };

      try {
        // Upload the row's image (if any) regardless of match outcome, so a
        // later manual match confirmation can still attach it -- otherwise
        // an ambiguous/unmatched row's image would be lost for good.
        let imageUrl: string | null = null;
        if (row.imageBuffer && row.imageExtension) {
          const file = new File([new Uint8Array(row.imageBuffer)], `row-${row.rowNumber}.${row.imageExtension}`, {
            type: `image/${row.imageExtension}`,
          });
          const blob = await uploadBlob(`containers/${upload.id}/row-${row.rowNumber}.${row.imageExtension}`, file);
          imageUrl = blob.url;
        }

        const candidates = extractCandidateCodes(row);
        const classification = candidates.length
          ? classifyMatch(candidates, candidatePool)
          : ({ kind: "unmatched" } as const);

        if (classification.kind === "matched") {
          const order = acceptedOrders.find((o) => o.id === classification.orderId)!;
          let matchNote: string | null = null;
          if (row.totalQty !== null && order.acceptedQty !== null && row.totalQty !== order.acceptedQty) {
            matchNote = `Quantity mismatch: container has ${row.totalQty}, accepted qty was ${order.acceptedQty}`;
          }

          await prisma.containerItem.create({
            data: { ...baseData, imageUrl, matchStatus: "MATCHED", matchNote, matchedOrderId: order.id },
          });

          if (imageUrl) {
            await prisma.photo.create({
              data: {
                orderId: order.id,
                url: imageUrl,
                blobPathname: new URL(imageUrl).pathname.replace(/^\//, ""),
                source: "CONTAINER_IMPORT",
                uploadedById: user!.id,
              },
            });
          }

          await prisma.order.update({ where: { id: order.id }, data: { status: "IN_TRANSIT" } });

          await logActivity({
            actor: user,
            action: "CONTAINER_ITEM_MATCHED",
            entityType: "Order",
            entityId: order.id,
            newValue: { containerUploadId: upload.id, rowNumber: row.rowNumber, totalQty: row.totalQty },
            remarks: matchNote,
          });

          matchedCount++;
        } else if (classification.kind === "ambiguous") {
          await prisma.containerItem.create({
            data: { ...baseData, imageUrl, matchStatus: "AMBIGUOUS", matchNote: classification.note },
          });
          ambiguousCount++;
        } else {
          await prisma.containerItem.create({
            data: {
              ...baseData,
              imageUrl,
              matchStatus: "UNMATCHED",
              matchNote: "No accepted order matched this row's identifiers",
            },
          });
          unmatchedCount++;
        }
      } catch (rowErr) {
        errorCount++;
        await prisma.containerItem.create({
          data: {
            ...baseData,
            matchStatus: "ERROR",
            matchNote: rowErr instanceof Error ? rowErr.message : "Unknown error processing this row",
          },
        });
      }
    }

    const finished = await prisma.containerUpload.update({
      where: { id: upload.id },
      data: {
        status: "COMPLETED",
        totalRows: rows.length,
        matchedCount,
        ambiguousCount,
        unmatchedCount,
        errorCount,
      },
    });

    return NextResponse.json({
      id: finished.id,
      status: finished.status,
      totalRows: finished.totalRows,
      matchedCount: finished.matchedCount,
      ambiguousCount: finished.ambiguousCount,
      unmatchedCount: finished.unmatchedCount,
      errorCount: finished.errorCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process the uploaded file";
    await prisma.containerUpload.update({
      where: { id: upload.id },
      data: { status: "FAILED", errorMessage: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
