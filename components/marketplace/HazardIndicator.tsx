function barColor(level: number, bar: number): string {
  if (bar > level) return "rgba(255,255,255,0.12)";
  if (level <= 2) return "var(--nafas-accent2)";
  if (level === 3) return "var(--nafas-amber)";
  return "var(--nafas-danger)";
}

export function HazardIndicator({ level }: { level: number }) {
  return (
    <div className="flex items-end gap-[3px]" aria-label={`Niveau de danger ${level}/5`}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <span
          key={bar}
          aria-hidden
          style={{
            display: "block",
            width: 4,
            height: 4 + bar * 2,
            borderRadius: 1,
            background: barColor(level, bar),
            transition: "background 200ms",
          }}
        />
      ))}
      <span className="tac-label text-[8px] ml-1" style={{ color: barColor(level, 1) }}>
        {level}/5
      </span>
    </div>
  );
}
