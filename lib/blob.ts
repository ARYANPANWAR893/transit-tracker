import { put, del } from "@vercel/blob";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Image storage has two drivers:
 *
 *  - Vercel Blob, whenever BLOB_READ_WRITE_TOKEN is set. This is what
 *    production uses; blobs are durable and served from Vercel's CDN.
 *  - A local-disk driver, used only in development when no token is set.
 *    Files land in .uploads/ and are served back by /api/uploads/[...path].
 *
 * The local driver exists so image upload is testable without provisioning a
 * Blob store. It is deliberately NOT allowed in production: serverless
 * filesystems are ephemeral and per-instance, so anything written there would
 * disappear and would not be visible to other instances.
 */

const LOCAL_DIR = path.join(process.cwd(), ".uploads");
const LOCAL_URL_PREFIX = "/api/uploads/";

export class BlobNotConfiguredError extends Error {
  constructor() {
    super(
      "Image storage isn't configured: BLOB_READ_WRITE_TOKEN is missing. " +
        "Add it from the Vercel dashboard (Storage → your Blob store → .env.local tab). " +
        "Everything else works without it; only image upload and container image extraction need it."
    );
    this.name = "BlobNotConfiguredError";
  }
}

function hasToken(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function localDriverAllowed(): boolean {
  return !hasToken() && process.env.NODE_ENV !== "production";
}

/** Resolve a stored-file path, refusing anything that escapes LOCAL_DIR. */
export function resolveLocalUpload(relativePath: string): string {
  const resolved = path.resolve(LOCAL_DIR, relativePath);
  const root = path.resolve(LOCAL_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Invalid upload path");
  }
  return resolved;
}

export async function uploadBlob(pathname: string, file: File): Promise<{ url: string; pathname: string }> {
  if (hasToken()) {
    const blob = await put(pathname, file, { access: "public", addRandomSuffix: true });
    return { url: blob.url, pathname: blob.pathname };
  }

  if (!localDriverAllowed()) throw new BlobNotConfiguredError();

  const destination = resolveLocalUpload(pathname);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await file.arrayBuffer()));

  const url = LOCAL_URL_PREFIX + pathname.split("/").map(encodeURIComponent).join("/");
  return { url, pathname };
}

/** Vercel Blob deletes are keyed by the blob's full URL; local files by path. */
export async function deleteBlob(url: string): Promise<void> {
  if (url.startsWith(LOCAL_URL_PREFIX)) {
    const relative = url
      .slice(LOCAL_URL_PREFIX.length)
      .split("/")
      .map(decodeURIComponent)
      .join("/");
    await unlink(resolveLocalUpload(relative)).catch((err) => {
      // Already gone is a successful outcome for a delete.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    });
    return;
  }

  if (!hasToken()) throw new BlobNotConfiguredError();
  await del(url);
}
