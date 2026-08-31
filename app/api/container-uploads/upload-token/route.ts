import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/session";
import { canUploadManifest } from "@/lib/permissions";

/**
 * Issues a short-lived client token so the browser can upload the raw xlsx
 * directly to Vercel Blob, bypassing the Next.js route body-size limit
 * (these packing lists run 30MB+ with embedded images).
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canUploadManifest(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
        ],
        addRandomSuffix: true,
        maximumSizeInBytes: 100 * 1024 * 1024,
        tokenPayload: JSON.stringify({ pathname }),
      }),
      // No onUploadCompleted webhook -- Vercel can't call back to localhost during
      // dev, and it isn't needed since the client explicitly kicks off processing
      // via POST /api/container-uploads once the upload finishes.
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create upload token" },
      { status: 400 }
    );
  }
}
