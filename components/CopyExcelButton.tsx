"use client";

import { useState } from "react";
import { requirementsToTsv } from "@/lib/tsv";
import { secondaryButtonClass } from "@/lib/formStyles";
import type { RequirementListResponse } from "@/lib/types";

/** Copies everything still moving, as TSV, ready to paste into a spreadsheet. */
export default function CopyExcelButton() {
  const [state, setState] = useState<"idle" | "copying" | "done" | "error">("idle");

  async function handleCopy() {
    setState("copying");
    try {
      const res = await fetch("/api/requirements?pageSize=200");
      if (!res.ok) throw new Error();
      const data: RequirementListResponse = await res.json();
      await navigator.clipboard.writeText(requirementsToTsv(data.items));
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  return (
    <button onClick={handleCopy} disabled={state === "copying"} className={secondaryButtonClass}>
      {state === "done" ? "Copied" : state === "error" ? "Couldn't copy" : "Copy Excel"}
    </button>
  );
}
