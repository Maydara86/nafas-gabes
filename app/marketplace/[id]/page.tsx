"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useBatch } from "@/lib/marketplace/hooks";
import { getBatchMetadata, type BatchMetadata } from "@/lib/marketplace/supabase";
import { BatchStatus } from "@/lib/marketplace/contract";
import { StatusBadge } from "@/components/marketplace/StatusBadge";
import { HazardIndicator } from "@/components/marketplace/HazardIndicator";
import { ClaimButton } from "@/components/marketplace/ClaimButton";
import { ConfirmCollectionButton } from "@/components/marketplace/ConfirmCollectionButton";
import { MarkProcessedForm } from "@/components/marketplace/MarkProcessedForm";
import { WalletConnect } from "@/components/marketplace/WalletConnect";

export default function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const batchId = BigInt(id);

  const { data: batch, isLoading } = useBatch(batchId);
  const { address, isConnected } = useAccount();
  const [metadata, setMetadata] = useState<BatchMetadata | null>(null);

  useEffect(() => {
    getBatchMetadata(batchId).then(setMetadata);
  }, [batchId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="size-6 rounded-full border-2 border-[color:var(--nafas-cyan)]/20 border-t-[color:var(--nafas-cyan)] animate-spin" />
      </div>
    );
  }

  if (!batch || batch.id === 0n) {
    return (
      <div className="px-6 py-10 text-center">
        <span className="tac-label text-[color:var(--nafas-ink3)]/60">
          Lot introuvable
        </span>
        <br />
        <Link href="/marketplace" className="tac-btn mt-4 inline-flex">
          ← Retour au marché
        </Link>
      </div>
    );
  }

  const isFactory = isConnected && address?.toLowerCase() === batch.factory.toLowerCase();
  const isClaimer = isConnected && address?.toLowerCase() === batch.claimer.toLowerCase();

  // Determine which action to show
  function renderAction() {
    if (!batch) return null;
    if (!isConnected) {
      return (
        <div className="tac-panel px-4 py-4 space-y-3 text-center">
          <p className="tac-label text-[8.5px] text-[color:var(--nafas-ink3)]/80">
            Connectez votre portefeuille pour interagir
          </p>
          <WalletConnect />
        </div>
      );
    }

    // LISTED — any non-factory wallet can claim
    if (batch.status === BatchStatus.LISTED && !isFactory) {
      return <ClaimButton batchId={batchId} />;
    }

    // CLAIMED — only factory can confirm collection
    if (batch.status === BatchStatus.CLAIMED && isFactory) {
      return <ConfirmCollectionButton batchId={batchId} />;
    }

    // COLLECTED — only claimer can mark processed
    if (batch.status === BatchStatus.COLLECTED && isClaimer) {
      return <MarkProcessedForm batchId={batchId} />;
    }

    return null;
  }

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto space-y-5">
      <Link href="/marketplace" className="tac-label text-[8.5px] text-[color:var(--nafas-ink3)]/70 hover:text-[color:var(--nafas-cyan)] transition-colors">
        ← Marché des déchets
      </Link>

      {/* Main card */}
      <div className="tac-panel p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-[20px] mb-1"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
            >
              {batch.wasteType}
            </h1>
            <span className="tac-label text-[8.5px] text-[color:var(--nafas-ink3)]/70">
              Lot #{String(batch.id)}
            </span>
          </div>
          <StatusBadge status={batch.status} />
        </div>

        <div className="tac-divider-h" />

        {/* Data rows */}
        <div className="grid grid-cols-2 gap-4">
          <DataRow label="Quantité">
            <span className="tac-readout text-[14px]">
              {Number(batch.quantity).toLocaleString("fr-FR")} kg
            </span>
          </DataRow>

          <DataRow label="Niveau de danger">
            <HazardIndicator level={batch.hazardLevel} />
          </DataRow>

          <DataRow label="Lieu">
            <span className="tac-readout text-[11px]">
              {metadata?.location_label ?? batch.location}
            </span>
          </DataRow>

          <DataRow label="GPS">
            <span className="tac-readout text-[11px]">{batch.location}</span>
          </DataRow>

          <DataRow label="Usine">
            <span className="tac-readout text-[10px]">
              {batch.factory.slice(0, 8)}…{batch.factory.slice(-6)}
            </span>
          </DataRow>

          {batch.claimer !== "0x0000000000000000000000000000000000000000" && (
            <DataRow label="Opérateur">
              <span className="tac-readout text-[10px]">
                {batch.claimer.slice(0, 8)}…{batch.claimer.slice(-6)}
              </span>
            </DataRow>
          )}

          {batch.outputType && (
            <DataRow label="Produit">
              <span className="tac-readout text-[11px]">{batch.outputType}</span>
            </DataRow>
          )}
        </div>

        {/* Description */}
        {metadata?.description && (
          <>
            <div className="tac-divider-h" />
            <div>
              <span className="tac-label block mb-1.5">DESCRIPTION</span>
              <p
                className="text-[12px] text-[color:var(--nafas-ink3)]"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                {metadata.description}
              </p>
            </div>
          </>
        )}

        {/* Basescan link */}
        <div className="flex justify-end">
          <a
            href={`https://sepolia.basescan.org/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tac-btn"
          >
            Voir le contrat ↗
          </a>
        </div>
      </div>

      {/* Action panel */}
      {renderAction()}
    </div>
  );
}

function DataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="tac-label block mb-1">{label}</span>
      {children}
    </div>
  );
}
