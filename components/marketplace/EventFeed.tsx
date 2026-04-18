"use client";

import { useState } from "react";
import {
  useMarketplaceEvents,
  type MarketplaceEvent,
} from "@/lib/marketplace/hooks";

function eventLabel(e: MarketplaceEvent): string {
  switch (e.type) {
    case "listed":
      return `Lot #${e.id} listé — ${e.wasteType} · ${Number(e.quantity).toLocaleString("fr-FR")} kg`;
    case "claimed":
      return `Lot #${e.id} réclamé par ${e.claimer.slice(0, 6)}…${e.claimer.slice(-4)}`;
    case "collected":
      return `Lot #${e.id} — collecte confirmée`;
    case "processed":
      return `Lot #${e.id} traité → ${e.outputType}`;
  }
}

function eventDotClass(e: MarketplaceEvent): string {
  switch (e.type) {
    case "listed":    return "tac-dot tac-dot--cyan";
    case "claimed":   return "tac-dot tac-dot--amber";
    case "collected": return "tac-dot";
    case "processed": return "tac-dot tac-dot--accent";
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

export function EventFeed() {
  const [events, setEvents] = useState<MarketplaceEvent[]>([]);

  useMarketplaceEvents((e) =>
    setEvents((prev) => [e, ...prev].slice(0, 50)),
  );

  return (
    <div className="tac-panel h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-white/[0.07]">
        <span className="tac-bracket">Flux en direct</span>
        <span className="tac-dot tac-dot--cyan tac-blink" />
      </div>
      <ul className="flex-1 overflow-y-auto py-1">
        {events.length === 0 && (
          <li className="px-3 py-3">
            <span className="tac-label text-[color:var(--nafas-ink3)]/50">
              En attente d'événements on-chain…
            </span>
          </li>
        )}
        {events.map((e, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 px-3 py-2 border-b border-white/[0.04] last:border-0"
          >
            <span className={`${eventDotClass(e)} mt-[3px] shrink-0`} />
            <div className="flex-1 min-w-0">
              <span className="tac-label text-[8.5px] text-[color:var(--nafas-surface)]/80 leading-relaxed">
                {eventLabel(e)}
              </span>
            </div>
            <span className="tac-label text-[8px] text-[color:var(--nafas-ink3)]/60 shrink-0">
              {formatTime(e.timestamp)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
