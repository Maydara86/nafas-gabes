"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useListWaste } from "@/lib/marketplace/hooks";
import { createBatchMetadata } from "@/lib/marketplace/supabase";
import { WalletConnect } from "./WalletConnect";

const WASTE_TYPES = [
  "Phosphogypse",
  "Fluorure",
  "Acide sulfurique résiduel",
  "Boues de phosphate",
  "Ammoniac",
  "Autre",
];

export function ListWasteForm() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { listWaste, isPending, error } = useListWaste();

  const [wasteType,     setWasteType]     = useState(WASTE_TYPES[0]);
  const [quantity,      setQuantity]      = useState("");
  const [hazardLevel,   setHazardLevel]   = useState(3);
  const [location,      setLocation]      = useState("33.9312,10.1178");
  const [locationLabel, setLocationLabel] = useState("GCT Ghannouch, Gabès");
  const [description,   setDescription]   = useState("");
  const [submitError,   setSubmitError]   = useState<string | null>(null);

  if (!isConnected) {
    return (
      <div className="tac-panel p-6 text-center space-y-3">
        <p className="tac-label text-[color:var(--nafas-ink3)]/80">
          Connectez votre portefeuille pour lister un lot
        </p>
        <WalletConnect />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setSubmitError("La quantité doit être un nombre positif.");
      return;
    }

    try {
      const batchId = await listWaste({
        wasteType,
        quantity:    BigInt(Math.round(qty)),
        hazardLevel,
        location,
      });

      await createBatchMetadata({
        batch_id:       batchId,
        description,
        photo_url:      null,
        location_label: locationLabel,
      });

      router.push(`/marketplace/${batchId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="tac-panel p-6 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="tac-bracket">Nouveau lot de déchets</span>
      </div>

      <div className="tac-divider-h" />

      {/* Type de déchet */}
      <div>
        <label className="tac-label block mb-1.5">TYPE DE DÉCHET</label>
        <select
          value={wasteType}
          onChange={(e) => setWasteType(e.target.value)}
          className="w-full tac-btn text-left px-3 py-2"
          style={{ background: "rgba(255,255,255,0.04)" }}
          required
        >
          {WASTE_TYPES.map((t) => (
            <option key={t} value={t} style={{ background: "var(--nafas-bg2)" }}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Quantité */}
      <div>
        <label className="tac-label block mb-1.5">QUANTITÉ (kg)</label>
        <input
          type="number"
          min="1"
          step="1"
          placeholder="ex : 4200"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          className="w-full tac-btn text-left px-3 py-2 tac-readout"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      </div>

      {/* Niveau de danger */}
      <div>
        <label className="tac-label block mb-1.5">NIVEAU DE DANGER (1 – 5)</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setHazardLevel(n)}
              className="tac-btn flex-1 justify-center"
              data-active={hazardLevel === n ? "true" : undefined}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* GPS */}
      <div>
        <label className="tac-label block mb-1.5">COORDONNÉES GPS (lat,lon)</label>
        <input
          type="text"
          placeholder="33.9312,10.1178"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          className="w-full tac-btn text-left px-3 py-2 tac-readout"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      </div>

      {/* Lieu (label) */}
      <div>
        <label className="tac-label block mb-1.5">NOM DU LIEU</label>
        <input
          type="text"
          placeholder="GCT Ghannouch, Gabès"
          value={locationLabel}
          onChange={(e) => setLocationLabel(e.target.value)}
          className="w-full tac-btn text-left px-3 py-2"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      </div>

      {/* Description */}
      <div>
        <label className="tac-label block mb-1.5">DESCRIPTION (optionnel)</label>
        <textarea
          rows={3}
          placeholder="Informations complémentaires sur le lot…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full tac-btn text-left px-3 py-2 resize-none"
          style={{ background: "rgba(255,255,255,0.04)", fontFamily: "inherit", fontSize: "12px" }}
        />
      </div>

      {/* Errors */}
      {(submitError || error) && (
        <div className="tac-panel px-4 py-2" data-tone="danger">
          <span className="tac-label text-[color:var(--nafas-danger)]">
            {submitError ?? error?.message}
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="tac-btn w-full justify-center py-3"
        data-active={isPending ? "true" : undefined}
        style={
          !isPending
            ? { borderColor: "rgba(62,201,208,0.6)", color: "var(--nafas-cyan)" }
            : {}
        }
      >
        {isPending ? "Signature + confirmation blockchain…" : "Lister le lot"}
      </button>
    </form>
  );
}
