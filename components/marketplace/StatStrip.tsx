import { BatchStatus, type WasteBatch } from "@/lib/marketplace/contract";

export function StatStrip({ batches }: { batches: WasteBatch[] }) {
  const totalKg = batches.reduce((sum, b) => sum + Number(b.quantity), 0);
  const processed = batches.filter(
    (b) => b.status === BatchStatus.PROCESSED,
  ).length;

  return (
    <div className="tac-panel flex items-stretch divide-x divide-white/[0.07]">
      <Stat label="Lots listés"  value={String(batches.length)}              />
      <Stat label="kg détournés" value={totalKg.toLocaleString("fr-FR")}    />
      <Stat label="Lots traités" value={String(processed)}                   unit={`/ ${batches.length}`} />
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col px-5 py-3 gap-1 min-w-[100px]">
      <span className="tac-label text-[8px] text-[color:var(--nafas-ink3)]/70">
        {label}
      </span>
      <span className="tac-readout text-[18px] text-[color:var(--nafas-surface)] leading-none">
        {value}
        {unit && (
          <span className="tac-label text-[9px] ml-1.5 text-[color:var(--nafas-ink3)]">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}
