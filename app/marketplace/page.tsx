"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { useAllBatches } from "@/lib/marketplace/hooks";
import { listBatchesMetadata, type BatchMetadata } from "@/lib/marketplace/supabase";
import { BatchGrid } from "@/components/marketplace/BatchGrid";
import { StatStrip } from "@/components/marketplace/StatStrip";
import { EventFeed } from "@/components/marketplace/EventFeed";
import { WalletConnect } from "@/components/marketplace/WalletConnect";

export default function MarketplacePage() {
  const { data: batches, isLoading } = useAllBatches();
  const [metaMap, setMetaMap] = useState<Map<bigint, BatchMetadata>>(new Map());

  // Fetch Supabase metadata whenever the batch list changes
  useEffect(() => {
    if (!batches || batches.length === 0) return;
    const ids = batches.map((b) => b.id);
    listBatchesMetadata(ids).then((rows) => {
      setMetaMap(new Map(rows.map((r) => [r.batch_id, r])));
    });
  }, [batches]);

  const sortedBatches = useMemo(
    () => (batches ? [...batches].sort((a, b) => Number(b.id) - Number(a.id)) : []),
    [batches],
  );

  return (
    <div className="px-6 py-6 space-y-5">
      {/* top row — stat strip + wallet + list CTA */}
      <div className="flex items-stretch gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          {batches && <StatStrip batches={batches} />}
        </div>
        <div className="flex items-center gap-3 tac-panel px-4 py-2">
          <WalletConnect />
          <div className="tac-divider-v" />
          <Link
            href="/marketplace/list"
            className="tac-btn"
            style={{ borderColor: "rgba(62,201,208,0.6)", color: "var(--nafas-cyan)" }}
          >
            + Lister un lot
          </Link>
        </div>
      </div>

      {/* main content — grid + feed */}
      <div className="flex gap-5">
        {/* batch grid — takes all remaining width */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="tac-panel p-10 text-center">
              <div className="size-6 rounded-full border-2 border-[color:var(--nafas-cyan)]/20 border-t-[color:var(--nafas-cyan)] animate-spin mx-auto mb-3" />
              <span className="tac-label text-[color:var(--nafas-ink3)]/70">
                Chargement de la blockchain…
              </span>
            </div>
          ) : (
            <BatchGrid batches={sortedBatches} metaMap={metaMap} />
          )}
        </div>

        {/* live event feed — fixed width sidebar */}
        <div className="w-72 shrink-0 hidden lg:block" style={{ minHeight: 400 }}>
          <EventFeed />
        </div>
      </div>
    </div>
  );
}
