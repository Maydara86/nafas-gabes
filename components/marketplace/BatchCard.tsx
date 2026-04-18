import Link from "next/link";
import { BatchStatus, type WasteBatch } from "@/lib/marketplace/contract";
import type { BatchMetadata } from "@/lib/marketplace/supabase";
import { StatusBadge } from "./StatusBadge";
import { HazardIndicator } from "./HazardIndicator";

const STATUS_STRIPE_COLOR: Record<number, string> = {
  [BatchStatus.LISTED]:    "var(--nafas-cyan)",
  [BatchStatus.CLAIMED]:   "var(--nafas-amber)",
  [BatchStatus.COLLECTED]: "var(--nafas-blue)",
  [BatchStatus.PROCESSED]: "var(--nafas-accent2)",
};

interface BatchCardProps {
  batch:    WasteBatch;
  metadata: BatchMetadata | null;
}

export function BatchCard({ batch, metadata }: BatchCardProps) {
  const stripeColor = STATUS_STRIPE_COLOR[batch.status];

  return (
    <Link href={`/marketplace/${batch.id}`} className="block group">
      <div className="tac-panel relative overflow-hidden hover:border-white/20 transition-colors">
        {/* left status stripe */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{
            background: stripeColor,
            boxShadow: `0 0 10px -1px ${stripeColor}`,
          }}
        />

        <div className="pl-4 pr-3 py-3 space-y-2">
          {/* row 1 — type + status */}
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[13px] font-medium truncate"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
            >
              {batch.wasteType}
            </span>
            <StatusBadge status={batch.status} />
          </div>

          {/* row 2 — quantity + hazard */}
          <div className="flex items-center gap-4">
            <div>
              <span className="tac-label text-[8px] block mb-0.5">QUANTITÉ</span>
              <span className="tac-readout text-[12px]">
                {Number(batch.quantity).toLocaleString("fr-FR")} kg
              </span>
            </div>
            <div>
              <span className="tac-label text-[8px] block mb-0.5">DANGER</span>
              <HazardIndicator level={batch.hazardLevel} />
            </div>
          </div>

          {/* row 3 — location label or GPS */}
          <div className="tac-label text-[8.5px] text-[color:var(--nafas-ink3)]/80 truncate">
            {metadata?.location_label ?? batch.location}
          </div>

          {/* row 4 — description (if any) */}
          {metadata?.description && (
            <div
              className="text-[11px] text-[color:var(--nafas-ink3)] line-clamp-2"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {metadata.description}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
