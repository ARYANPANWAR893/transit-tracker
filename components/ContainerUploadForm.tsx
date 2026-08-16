"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/formStyles";

function suggestName(fileName: string): string {
  const base = fileName.replace(/\.xlsx?$/i, "");
  const match = base.match(/FOR\s+(.+)$/i);
  return (match ? match[1] : base).replace(/\s+/g, "").toUpperCase();
}

export default function ContainerUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [containerName, setContainerName] = useState("");
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function handleFile(f: File | null) {
    setFile(f);
    if (f) setContainerName(suggestName(f.name));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !containerName.trim()) return;
    setError(null);

    try {
      setPhase("uploading");
      const blob = await upload(`container-excels/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/container-uploads/upload-token",
        multipart: true,
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      setPhase("processing");
      const res = await fetch("/api/container-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ containerName: containerName.trim(), blobUrl: blob.url, fileName: file.name }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to process the container file");
      }

      const result = await res.json();
      router.push(`/container-uploads/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPhase("idle");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5"
    >
      <h2 className="mb-3 font-semibold">Upload Container Excel</h2>

      <div className="mb-3">
        <label className={labelClass}>Packing list (.xlsx)</label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </div>

      {file && (
        <div className="mb-3">
          <label className={labelClass}>Container name</label>
          <input
            value={containerName}
            onChange={(e) => setContainerName(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={!file || !containerName.trim() || phase !== "idle"}
        className={primaryButtonClass}
      >
        {phase === "uploading" && `Uploading… ${Math.round(progress)}%`}
        {phase === "processing" && "Matching against accepted orders…"}
        {phase === "idle" && "Upload & Match"}
      </button>
    </form>
  );
}
