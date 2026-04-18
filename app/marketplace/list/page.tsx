import { ListWasteForm } from "@/components/marketplace/ListWasteForm";

export const metadata = { title: "NAFAS · Lister un lot" };

export default function ListWastePage() {
  return (
    <div className="px-6 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="space-y-1">
          <h1
            className="text-[22px]"
            style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
          >
            Lister un lot de déchets
          </h1>
          <p className="tac-label text-[9px] text-[color:var(--nafas-ink3)]/70">
            La transaction sera enregistrée sur la blockchain Base Sepolia.
            Les métadonnées (description, lieu) sont stockées dans notre base de données.
          </p>
        </div>
        <ListWasteForm />
      </div>
    </div>
  );
}
