"use client";

import { useState } from "react";
import { useMarkProcessed } from "@/lib/marketplace/hooks";

const OUTPUT_TYPES = [
  "Système à algues — purification de l'air",
  "Engrais recyclé",
  "Matériau d'emballage",
  "Fibre textile",
  "Autre",
];

export function MarkProcessedForm({ batchId }: { batchId: bigint }) {
  const [outputType, setOutputType] = useState(OUTPUT_TYPES[0]);
  const { markProcessed, isPending, isSuccess } = useMarkProcessed();

  if (isSuccess) {
    return (
      <div className="tac-panel px-4 py-3 text-center">
        <span className="tac-label text-[color:var(--nafas-accent2)]">
          ✓ Traitement enregistré
        </span>
      </div>
    );
  }

  return (
    <div className="tac-panel p-4 space-y-3">
      <span className="tac-bracket">Marquer comme traité</span>
      <div>
        <label className="tac-label block mb-1.5">TYPE DE SORTIE</label>
        <select
          value={outputType}
          onChange={(e) => setOutputType(e.target.value)}
          className="w-full tac-btn text-left"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          {OUTPUT_TYPES.map((t) => (
            <option key={t} value={t} style={{ background: "var(--nafas-bg2)" }}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => markProcessed(batchId, outputType)}
        className="tac-btn w-full justify-center py-3"
        data-active={isPending ? "true" : undefined}
      >
        {isPending ? "Transaction en cours…" : "Enregistrer le traitement"}
      </button>
    </div>
  );
}
