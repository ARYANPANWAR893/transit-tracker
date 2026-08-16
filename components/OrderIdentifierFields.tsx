"use client";

import type { ProductDraft, ProductFamily } from "@/lib/types";
import { inputClass, labelClass } from "@/lib/formStyles";

const IDENTIFIER_LABELS: { key: keyof ProductDraft; label: string }[] = [
  { key: "amazonSku", label: "Amazon SKU" },
  { key: "amazonAsin", label: "Amazon ASIN" },
  { key: "flipkartSku", label: "Flipkart SKU" },
  { key: "flipkartAsin", label: "Flipkart ASIN" },
  { key: "maSku", label: "MASKU" },
  { key: "kmwId", label: "KMW ID" },
];

export default function OrderIdentifierFields({
  draft,
  onChange,
  families,
  hasImage,
}: {
  draft: ProductDraft;
  onChange: (next: ProductDraft) => void;
  families: ProductFamily[];
  hasImage: boolean;
}) {
  const anyFilled = IDENTIFIER_LABELS.some(({ key }) => draft[key]) || hasImage;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Product name (optional)</label>
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Helps everyone recognize it at a glance"
          className={inputClass}
        />
      </div>

      <p className="text-xs text-black/50 dark:text-white/50">
        Fill in whichever of these you have — just one is enough. A product photo also counts.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {IDENTIFIER_LABELS.map(({ key, label }) => (
          <div key={key}>
            <label className={labelClass}>{label}</label>
            <input
              value={draft[key] ?? ""}
              onChange={(e) => onChange({ ...draft, [key]: e.target.value || null })}
              className={inputClass}
            />
          </div>
        ))}
      </div>

      <div>
        <label className={labelClass}>Family (optional)</label>
        <select
          value={draft.familyId ?? ""}
          onChange={(e) => onChange({ ...draft, familyId: e.target.value || null })}
          className={inputClass}
        >
          <option value="">Unassigned</option>
          {families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {!anyFilled && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Provide at least one identifier above, or attach a photo, so the product can be recognized.
        </p>
      )}
    </div>
  );
}
