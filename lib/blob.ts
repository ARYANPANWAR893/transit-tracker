import { put, del } from "@vercel/blob";

export async function uploadBlob(pathname: string, file: File): Promise<{ url: string; pathname: string }> {
  const blob = await put(pathname, file, { access: "public", addRandomSuffix: true });
  return { url: blob.url, pathname: blob.pathname };
}

/** Vercel Blob deletes are keyed by the blob's full URL. */
export async function deleteBlob(url: string): Promise<void> {
  await del(url);
}
