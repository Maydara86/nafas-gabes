"use client";

import { useConfirmCollection } from "@/lib/marketplace/hooks";

export function ConfirmCollectionButton({ batchId }: { batchId: bigint }) {
  const { confirmCollection, isPending, isSuccess } = useConfirmCollection();

  if (isSuccess) {
    return (
      <div className="tac-panel px-4 py-3 text-center">
        <span className="tac-label text-[color:var(--nafas-accent2)]">
          ✓ Collecte confirmée
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => confirmCollection(batchId)}
      className="tac-btn w-full justify-center py-3"
      data-active={isPending ? "true" : undefined}
    >
      {isPending ? "Transaction en cours…" : "Confirmer la collecte"}
    </button>
  );
}
