import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveLocalUpload } from "@/lib/blob";
import { getCurrentUser } from "@/lib/session";

/**
 * Serves images written by the local-disk storage driver (development only --
 * see lib/blob.ts). In production these URLs are never generated, because
 * uploads go to Vercel Blob and are served from its CDN instead.
 */

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Order photos aren't public; require a session the same way the rest of the app does.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path: segments } = await params;

  let filePath: string;
  try {
    filePath = resolveLocalUpload(segments.map(decodeURIComponent).join("/"));
  } catch {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const file = await readFile(filePath);
    const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(file), {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
