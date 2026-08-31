import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canUploadManifest } from "@/lib/permissions";
import { logActivity } from "@/lib/activityLog";
import { uploadBlob, BlobNotConfiguredError } from "@/lib/blob";
import { parseContainerExcel, extractCandidateCodes, resolveProduct } from "@/lib/excelImport";
import { serializeContainerUpload } from "@/lib/containerSerializer";

export const maxDuration = 60;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uploads = await prisma.containerUpload.findMany({
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(uploads.map(serializeContainerUpload));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canUploadManifest(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fail fast: without storage every row's image would fail individually and the
  // run would finish "complete" with an error against all ~100 rows.
  if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: new BlobNotConfiguredError().message }, { status: 503 });
  }

  const { containerId, blobUrl, fileName } = await request.json();
  if (typeof containerId !== "string" || !containerId || typeof blobUrl !== "string" || !blobUrl ||
      typeof fileName !== "string" || !fileName) {
    return NextResponse.json({ error: "containerId, blobUrl and fileName are required" }, { status: 400 });
  }

  const container = await prisma.container.findUnique({
    where: { id: containerId },
    include: { allocations: { include: { requirement: { select: { productId: true } } } } },
  });
  if (!container) return NextResponse.json({ error: "Container not found" }, { status: 404 });

  const upload = await prisma.containerUpload.create({
    data: { containerId, fileName, blobUrl, uploadedById: user!.id, status: "PROCESSING" },
  });
  await logActivity({
    actor: user, action: "MANIFEST_UPLOADED", entityType: "Container", entityId: containerId,
    newValue: { uploadId: upload.id, fileName },
  });

  try {
    const fileRes = await fetch(blobUrl);
    if (!fileRes.ok) throw new Error(`Couldn't fetch the uploaded file (HTTP ${fileRes.status})`);
    const rows = await parseContainerExcel(Buffer.from(await fileRes.arrayBuffer()));

    // Every registered identifier, so a manifest code can resolve whatever kind it is.
    const identifiers = (
      await prisma.productIdentifier.findMany({ select: { productId: true, normalizedValue: true, type: true, value: true } })
    ).map((i) => ({ productId: i.productId, normalizedValue: i.normalizedValue, label: `${i.type} ${i.value}` }));

    // What Anish said should be in this container, per product.
    const expectedByProduct = new Map<string, number>();
    for (const a of container.allocations) {
      expectedByProduct.set(a.requirement.productId, (expectedByProduct.get(a.requirement.productId) ?? 0) + a.qty);
    }

    let matched = 0, ambiguous = 0, unmatched = 0, errors = 0;

    for (const row of rows) {
      try {
        let imageUrl: string | null = null;
        if (row.imageBuffer && row.imageExtension) {
          const file = new File([new Uint8Array(row.imageBuffer)], `row-${row.rowNumber}.${row.imageExtension}`, {
            type: `image/${row.imageExtension}`,
          });
          // Uploaded regardless of match outcome so a later manual resolution keeps the photo.
          imageUrl = (await uploadBlob(`containers/${container.code}/row-${row.rowNumber}.${row.imageExtension}`, file)).url;
        }

        const codes = extractCandidateCodes(row);
        const match = codes.length ? resolveProduct(codes, identifiers) : ({ kind: "unmatched" } as const);

        const base = {
          containerId, containerUploadId: upload.id, rowNumber: row.rowNumber,
          shippingMark: row.shippingMark, itemNo: row.itemNo, description: row.description,
          sectionLabel: row.sectionLabel, cartons: row.cartons, qtyPerCarton: row.qtyPerCarton,
          totalQty: row.totalQty, cbm: row.cbm, totalCbm: row.totalCbm,
          weight: row.weight, totalWeight: row.totalWeight, imageUrl,
        };

        if (match.kind === "matched") {
          // Flag a disagreement with the allocation rather than silently accepting it.
          const expected = expectedByProduct.get(match.productId);
          let note: string | null = `Resolved on ${match.matchedOn}`;
          if (expected !== undefined && row.totalQty !== null && row.totalQty !== expected) {
            note = `Quantity mismatch: manifest ${row.totalQty}, allocated ${expected}`;
          } else if (expected === undefined) {
            note = `Resolved on ${match.matchedOn} — not allocated to this container`;
          }
          await prisma.containerItem.create({
            data: { ...base, matchStatus: "MATCHED", matchNote: note, resolvedProductId: match.productId },
          });
          matched++;
        } else if (match.kind === "ambiguous") {
          await prisma.containerItem.create({
            data: { ...base, matchStatus: "AMBIGUOUS", matchNote: match.note },
          });
          ambiguous++;
        } else {
          await prisma.containerItem.create({
            data: { ...base, matchStatus: "UNMATCHED", matchNote: codes.length ? `Tried: ${codes.join(", ")}` : "No code found in this row" },
          });
          unmatched++;
        }
      } catch (rowErr) {
        await prisma.containerItem.create({
          data: {
            containerId, containerUploadId: upload.id, rowNumber: row.rowNumber,
            shippingMark: row.shippingMark, itemNo: row.itemNo, description: row.description,
            matchStatus: "ERROR",
            matchNote: rowErr instanceof Error ? rowErr.message : "Failed to process this row",
          },
        });
        errors++;
      }
    }

    const completed = await prisma.containerUpload.update({
      where: { id: upload.id },
      data: {
        status: "COMPLETED", totalRows: rows.length,
        matchedCount: matched, ambiguousCount: ambiguous, unmatchedCount: unmatched, errorCount: errors,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    await logActivity({
      actor: user, action: "MANIFEST_PROCESSED", entityType: "Container", entityId: containerId,
      newValue: { uploadId: upload.id, rows: rows.length, matched, ambiguous, unmatched, errors },
    });

    return NextResponse.json(serializeContainerUpload(completed), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process the manifest";
    const failed = await prisma.containerUpload.update({
      where: { id: upload.id },
      data: { status: "FAILED", errorMessage: message },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    await logActivity({
      actor: user, action: "MANIFEST_FAILED", entityType: "Container", entityId: containerId,
      newValue: { uploadId: upload.id }, remarks: message,
    });
    return NextResponse.json({ ...serializeContainerUpload(failed), error: message }, { status: 422 });
  }
}
