"use client";

import { useRef, useState } from "react";
import type { Photo, Product } from "@/lib/types";

export default function PhotoGallery({
  orderId,
  photos,
  product,
  canEdit,
  onChange,
}: {
  orderId: string;
  photos: Photo[];
  product: Product;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.set("file", file);

    const res = await fetch(`/api/orders/${orderId}/photos`, { method: "POST", body: formData });

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to upload photo");
      return;
    }
    onChange();
  }

  async function handleDelete(photoId: string) {
    if (!window.confirm("Delete this photo?")) return;
    const res = await fetch(`/api/orders/${orderId}/photos/${photoId}`, { method: "DELETE" });
    if (res.ok) onChange();
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Photos</h3>
        {canEdit && (
          <label className="cursor-pointer text-sm font-medium text-black underline dark:text-white">
            {uploading ? "Uploading…" : "Upload"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
      </div>

      {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {photos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-4 text-sm text-black/50 dark:border-white/20 dark:text-white/50">
          No photos yet. MA SKU: <span className="font-medium">{product.maSku}</span> · KM SKU:{" "}
          <span className="font-medium">{product.kmSku}</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element -- external Blob URLs, no build-time optimization needed */}
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
              {canEdit && (
                <button
                  onClick={() => handleDelete(photo.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
