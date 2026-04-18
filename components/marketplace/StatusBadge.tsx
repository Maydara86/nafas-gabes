import { BatchStatus, type BatchStatusValue } from "@/lib/marketplace/contract";

const STATUS_LABEL: Record<BatchStatusValue, string> = {
  [BatchStatus.LISTED]:    "LISTÉ",
  [BatchStatus.CLAIMED]:   "RÉCLAMÉ",
  [BatchStatus.COLLECTED]: "COLLECTÉ",
  [BatchStatus.PROCESSED]: "TRAITÉ",
};

const STATUS_COLOR: Record<BatchStatusValue, string> = {
  [BatchStatus.LISTED]:    "var(--nafas-cyan)",
  [BatchStatus.CLAIMED]:   "var(--nafas-amber)",
  [BatchStatus.COLLECTED]: "var(--nafas-blue)",
  [BatchStatus.PROCESSED]: "var(--nafas-accent2)",
};

export function StatusBadge({ status }: { status: BatchStatusValue }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="tac-label text-[8.5px] px-2 py-[3px] border rounded-sm"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        background:  `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
