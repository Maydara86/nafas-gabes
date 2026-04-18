"use client";

import { useClaimWaste } from "@/lib/marketplace/hooks";

export function ClaimButton({
  batchId,
  onSuccess,
}: {
  batchId: bigint;
  onSuccess?: () => void;
}) {
  const { claimWaste, isPending, isSuccess } = useClaimWaste();

  if (isSuccess) {
    return (
      <div className="tac-panel px-4 py-3 text-center">
        <span className="tac-label text-[color:var(--nafas-accent2)]">
          ✓ Lot réclamé — en attente de confirmation usine
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        claimWaste(batchId);
        if (onSuccess) onSuccess();
      }}
      className="tac-btn w-full justify-center py-3"
      data-active={isPending ? "true" : undefined}
    >
      {isPending ? "Transaction en cours…" : "Réclamer ce lot"}
    </button>
  );
}
