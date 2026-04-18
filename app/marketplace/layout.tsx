import Link from "next/link";
import { MarketplaceProviders } from "./providers";

export const metadata = { title: "NAFAS · Marché des déchets" };

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MarketplaceProviders>
      <div className="min-h-screen flex flex-col" style={{ background: "var(--nafas-bg)" }}>
        {/* top nav */}
        <nav className="tac-panel border-b border-white/[0.08] px-6 py-3 flex items-center justify-between shrink-0">
          <Link
            href="/monitor3d"
            className="tac-label text-[color:var(--nafas-ink3)] hover:text-[color:var(--nafas-cyan)] transition-colors flex items-center gap-2"
          >
            ← Retour au moniteur
          </Link>
          <span
            className="tac-label text-[10px] tracking-[0.32em] text-[color:var(--nafas-cyan)]"
          >
            NAFAS · MARCHÉ DES DÉCHETS
          </span>
          {/* WalletConnect rendered by each page — imported client-side */}
          <div id="wallet-connect-slot" />
        </nav>
        <main className="flex-1">{children}</main>
      </div>
    </MarketplaceProviders>
  );
}
