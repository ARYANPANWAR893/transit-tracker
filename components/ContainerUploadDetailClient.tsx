"use client";

import { useCallback, useEffect, useState } from "react";
import type { ContainerUploadDetail } from "@/lib/types";
import ContainerMatchReview from "@/components/ContainerMatchReview";

export default function ContainerUploadDetailClient({ id }: { id: string }) {
  const [upload, setUpload] = useState<ContainerUploadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/container-uploads/${id}`);
    if (res.ok) setUpload(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refresh();
  }, [refresh]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-black/40 dark:text-white/40">Loading…</p>;
  }
  if (!upload) {
    return <p className="py-12 text-center text-sm text-black/40 dark:text-white/40">Not found.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <h1 className="text-lg font-semibold">{upload.containerName}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          {upload.fileName} · uploaded by {upload.uploadedBy.name} · {upload.status}
        </p>
        {upload.errorMessage && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{upload.errorMessage}</p>
        )}
      </div>

      <ContainerMatchReview containerId={upload.id} items={upload.items} onChange={refresh} />
    </div>
  );
}
