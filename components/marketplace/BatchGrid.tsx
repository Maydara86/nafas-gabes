import type { WasteBatch } from "@/lib/marketplace/contract";
import type { BatchMetadata } from "@/lib/marketplace/supabase";
import { BatchCard } from "./BatchCard";

interface BatchGridProps {
  batches:   WasteBatch[];
  metaMap:   Map<bigint, BatchMetadata>;
}

export function BatchGrid({ batches, metaMap }: BatchGridProps) {
  if (batches.length === 0) {
    return (
      <div className="tac-panel px-6 py-10 text-center">
        <span className="tac-label text-[color:var(--nafas-ink3)]/60">
          Aucun lot listé pour le moment
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {batches.map((batch) => (
        <BatchCard
          key={String(batch.id)}
          batch={batch}
          metadata={metaMap.get(batch.id) ?? null}
        />
      ))}
    </div>
  );
}
