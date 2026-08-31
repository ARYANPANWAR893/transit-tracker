"use client";

import type { IdentifierType, ProductDraft, ProductFamily } from "@/lib/types";
import { IDENTIFIER_LABELS } from "@/lib/types";
import { inputClass, labelClass } from "@/lib/formStyles";

/** Ordered so the codes people actually know come first. */
const TYPES: IdentifierType[] = [
  "KMW", "KATTYMAO_SKU", "MA_SKU", "CHINA_CODE",
  "AMAZON_SKU", "AMAZON_ASIN", "FLIPKART_SKU", "FLIPKART_ASIN",
  "MEESHO_SKU", "MEESHO_PRODUCT_ID",
];

export default function ProductIdentifierFields({
  draft, onChange, families, hasImage,
}: {
  draft: ProductDraft;
  onChange: (next: ProductDraft) => void;
  families: ProductFamily[];
  hasImage: boolean;
}) {
  const valueFor = (type: IdentifierType) =>
    draft.identifiers.find((i) => i.type === type)?.value ?? "";

  function setValue(type: IdentifierType, value: string) {
    const rest = draft.identifiers.filter((i) => i.type !== type);
    onChange({ ...draft, identifiers: value.trim() ? [...rest, { type, value }] : rest });
  }

  const anyFilled = draft.identifiers.some((i) => i.value.trim()) || hasImage;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>Product name (optional)</label>
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Helps everyone recognise it at a glance"
          className={inputClass}
        />
      </div>

      <p className="text-xs text-black/50 dark:text-white/50">
        Fill in whichever codes you have — one is enough, and a photo counts too. Any of them can
        later match a packing list. Separate multiple codes of the same kind with commas.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TYPES.map((type) => (
          <div key={type}>
            <label className={labelClass}>{IDENTIFIER_LABELS[type]}</label>
            <input
              value={valueFor(type)}
              onChange={(e) => setValue(type, e.target.value)}
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
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {!anyFilled && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Add at least one identifier, or attach a photo, so this product can be recognised.
        </p>
      )}
    </div>
  );
}
