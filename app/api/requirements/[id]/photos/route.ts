import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canCommentOnRequirement } from "@/lib/permissions";
import { uploadBlob, BlobNotConfiguredError } from "@/lib/blob";
import { logActivity } from "@/lib/activityLog";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const requirement = await prisma.requirement.findUnique({
    where: { id }, select: { id: true, status: true, createdById: true },
  });
  if (!requirement) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  if (!canCommentOnRequirement(user, requirement)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Choose an image file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Images must be under 10MB" }, { status: 400 });
  }

  const pathname = `requirements/${id}/${crypto.randomUUID()}-${file.name}`;
  let url: string;
  let blobPathname: string;
  try {
    ({ url, pathname: blobPathname } = await uploadBlob(pathname, file));
  } catch (err) {
    // A missing storage token is a deployment problem, not a bad file.
    if (err instanceof BlobNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Photo upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to store the image" },
      { status: 502 }
    );
  }

  const photo = await prisma.photo.create({
    data: { requirementId: id, url, blobPathname, uploadedById: user.id, source: "REQUIREMENT_UPLOAD" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  await logActivity({
    actor: user, action: "PHOTO_UPLOADED", entityType: "Requirement", entityId: id, newValue: { url },
  });

  return NextResponse.json(
    {
      id: photo.id, requirementId: photo.requirementId, url: photo.url, source: photo.source,
      uploadedById: photo.uploadedById, uploadedBy: photo.uploadedBy,
      createdAt: photo.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
