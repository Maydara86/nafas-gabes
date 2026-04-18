# Chemical Waste Marketplace — Design Spec
**Date:** 2026-04-18  
**Branch:** blockchain  
**Context:** Anti-pollution hackathon, Gabès region, Tunisia

---

## Overview

A blockchain-powered marketplace where factories in the Gabès phosphate industrial
zone list chemical waste batches instead of dumping them. Photobioreactor operators
and recyclers claim batches and log what they produce from them. All state transitions
are recorded on-chain; the public can track every waste flow transparently.

---

## Actors

| Actor | Role |
|---|---|
| Factory | Lists waste batches, confirms physical pickup |
| Photobioreactor operator | Claims waste, converts to algae-based air purification systems |
| Recycler | Claims waste for upcycled products (clothing, packaging) |
| Public | Read-only dashboard — no wallet required |

---

## Architecture

Two domains, one repo:

```
repo root
├── contracts/                        ← Foundry workspace
│   ├── src/WasteMarketplace.sol
│   ├── test/WasteMarketplace.t.sol
│   ├── script/Deploy.s.sol
│   └── foundry.toml
│
├── app/marketplace/                  ← Next.js marketplace section
│   ├── layout.tsx                    ← WagmiProvider + QueryClientProvider (scoped)
│   ├── page.tsx                      ← Public read-only dashboard
│   ├── list/page.tsx                 ← Factory: list a new batch
│   └── [id]/page.tsx                 ← Batch detail + context-aware action button
│
├── components/marketplace/           ← Marketplace UI components
├── lib/marketplace/                  ← wagmi config, ABI, hooks, Supabase queries
└── supabase/migrations/              ← waste_batch_metadata table + RLS policies

(existing app/monitor3d, components/monitor3d, etc. — untouched)
```

**WagmiProvider scope:** mounted only in `app/marketplace/layout.tsx` — Cesium globe
pages are completely unaffected.

**Friend's scope (merging from main later):** Supabase auth tables, user accounts,
role assignments (factory / operator / recycler). Until merge, develop against a local
Supabase instance with a stub role column.

---

## Smart Contract

**File:** `contracts/src/WasteMarketplace.sol`  
**Chain:** Base Sepolia (primary; Arbitrum Sepolia as fallback if RPC issues on the day)  
**Toolchain:** Foundry (`forge build`, `forge test`, `forge script`)

### Struct & storage

```solidity
enum Status { LISTED, CLAIMED, COLLECTED, PROCESSED }

struct WasteBatch {
    uint256 id;
    address factory;       // msg.sender on listWaste
    address claimer;       // filled on claimWaste
    string  wasteType;     // "phosphogypsum", "fluoride", etc.
    uint256 quantity;      // kg
    uint8   hazardLevel;   // 1–5
    string  location;      // "33.9312,10.1178" — raw GPS string
    Status  status;
    string  outputType;    // filled on markProcessed ("algae", "fertiliser", …)
    uint256 listedAt;      // block.timestamp
}

mapping(uint256 => WasteBatch) public batches;
uint256 public batchCount;
```

### Functions

| Function | Caller | Guard | Effect |
|---|---|---|---|
| `listWaste(wasteType, quantity, hazardLevel, location)` | any wallet | quantity > 0, hazardLevel 1–5 | creates batch, emits BatchListed, returns id |
| `claimWaste(batchId)` | any wallet except batch.factory | status == LISTED | sets claimer, status → CLAIMED, emits BatchClaimed |
| `confirmCollection(batchId)` | batch.factory only | status == CLAIMED | status → COLLECTED, emits BatchCollected |
| `markProcessed(batchId, outputType)` | batch.claimer only | status == COLLECTED | sets outputType, status → PROCESSED, emits BatchProcessed |

### Read helpers

- `getBatch(id)` — returns single WasteBatch struct (detail page)
- `getAllBatches()` — returns full array (dashboard; acceptable at hackathon scale of ~20 batches)

### Events

```solidity
event BatchListed(uint256 indexed id, address indexed factory, string wasteType, uint256 quantity);
event BatchClaimed(uint256 indexed id, address indexed claimer);
event BatchCollected(uint256 indexed id);
event BatchProcessed(uint256 indexed id, string outputType);
```

**Access control philosophy:** listing and claiming are permissionless on-chain.
Role enforcement (which UI actions are shown) lives in the Supabase layer.
`confirmCollection` and `markProcessed` are enforced on-chain via address checks —
the two critical steps are tamper-proof regardless of the frontend.

---

## Frontend Routes & Components

### Routes

```
app/marketplace/
├── layout.tsx          ← WagmiProvider + QueryClientProvider
├── page.tsx            ← Public dashboard — all batches, no wallet needed
├── list/page.tsx       ← Factory batch listing form (wallet required)
└── [id]/page.tsx       ← Batch detail + context-aware action button
```

### Components

```
components/marketplace/
├── WalletConnect.tsx            ← Connect/disconnect (wagmi useAccount)
├── BatchCard.tsx                ← Batch summary: type, quantity, hazard, status
├── BatchGrid.tsx                ← Maps over batches array → BatchCards
├── StatusBadge.tsx              ← Colour-coded pill per status
├── HazardIndicator.tsx          ← 1–5 bar visual (signal-bar style)
├── ListWasteForm.tsx            ← Controlled form → listWaste()
├── ClaimButton.tsx              ← claimWaste(batchId)
├── ConfirmCollectionButton.tsx  ← confirmCollection(batchId)
└── MarkProcessedForm.tsx        ← outputType input → markProcessed(batchId, output)
```

### Non-UI layer

```
lib/marketplace/
├── wagmiConfig.ts    ← chain config (Base/Arbitrum Sepolia), RPC, connectors
├── contract.ts       ← ABI export + NEXT_PUBLIC_CONTRACT_ADDRESS
├── hooks.ts          ← useAllBatches(), useBatch(id), useListWaste(),
│                        useClaimWaste(), useConfirmCollection(), useMarkProcessed()
└── supabase.ts       ← createBatchMetadata(), getBatchMetadata(batchId),
                         listBatchesMetadata(ids)
```

### Page behaviour

**`/marketplace` (public dashboard)**
- `useAllBatches()` → `useReadContract(getAllBatches)` → WasteBatch[]
- Extract all batch_ids → `listBatchesMetadata(ids)` (single Supabase query)
- Merge by batch_id → render BatchGrid
- Right panel: live event feed via `useWatchContractEvent` (no polling)
- Top stat strip: total batches listed / total kg diverted / batches processed
- No wallet required

**`/marketplace/[id]` (batch detail)**
- `useBatch(id)` + `getBatchMetadata(id)`
- Action button rendered based on: connected wallet vs batch.factory / batch.claimer + current status
- Unauthenticated: read-only view

**`/marketplace/list` (factory form)**
- Wallet connect gate
- On submit: `useListWaste()` → tx confirmed → POST metadata to Supabase with returned batchId → redirect to `/marketplace/[id]`

---

## Data Flow

### Write path — listing a batch

```
Factory fills ListWasteForm
  → useListWaste() → writeContract
    → WasteMarketplace.listWaste() on L2 testnet
      → tx confirmed → parse BatchListed event from receipt logs → extract batchId
  → POST to Supabase: { batch_id, description, photo_url, location_label }
  → redirect to /marketplace/[batchId]
```

Supabase write happens after tx confirmation — batch_id is always the on-chain id.

### Write path — claim / confirm / process

```
User clicks action button on /marketplace/[id]
  → useClaimWaste(batchId) (or confirm / markProcessed)
  → writeContract → tx pending → button: spinner + "En cours…"
  → useWaitForTransactionReceipt resolves
  → invalidate useAllBatches cache → status badge updates automatically
```

### Read path — dashboard

```
page.tsx mounts
  → useReadContract(getAllBatches) → WasteBatch[]
  → listBatchesMetadata(ids) → Supabase WHERE batch_id = ANY(...)
  → merge → render BatchGrid
```

### Error states

| Error | Behaviour |
|---|---|
| Tx rejected by user | Toast: "Transaction annulée" |
| Tx reverted on-chain | Parse revert reason → toast with message |
| Supabase write fails after tx confirms | Log error, show retry banner (batch exists on-chain) |
| RPC unavailable | wagmi auto-retries with backoff; banner: "Réseau indisponible" |

---

## Supabase Schema

```sql
create table waste_batch_metadata (
  batch_id       bigint primary key,    -- matches on-chain uint256 id
  user_id        uuid references auth.users,
  description    text,
  photo_url      text,
  location_label text,                  -- human display name for GPS coords
  created_at     timestamptz default now()
);

-- RLS
alter table waste_batch_metadata enable row level security;

-- anyone can read
create policy "public read"
  on waste_batch_metadata for select using (true);

-- only authenticated factories can insert
create policy "factory insert"
  on waste_batch_metadata for insert
  with check (auth.uid() = user_id);
```

Role check (`factory` role) will be wired to the friend's user table after merge.
Until then, any authenticated user can insert during development.

---

## Visual Design

Reuses existing NAFAS design tokens and CSS classes. No new design system.

### Status badge colours

| Status | Token | Meaning |
|---|---|---|
| LISTED | `--nafas-cyan` | Available |
| CLAIMED | `--nafas-amber` | In transit |
| COLLECTED | `--nafas-blue` | At facility |
| PROCESSED | `--nafas-accent2` | Complete |

### Hazard level indicator

Five-bar signal-strength style:
- 1–2 → `--nafas-accent2` (green)
- 3 → `--nafas-amber` (amber)
- 4–5 → `--nafas-danger` (red)

### BatchCard

`tac-panel` container with left accent stripe (colour = status colour), `tac-label`
for field names, `tac-readout` for values. Monospace tabular numbers for quantity
and hazard level. Same pattern as `TacticalLayers` rows.

### Public dashboard layout

Full-width BatchGrid + live event feed on the right (timestamped chain events from
`useWatchContractEvent`) + top stat strip. `tac-panel` + `tac-bracket` throughout.

### List form

Centred single-column, `tac-panel` container, `tac-label` above each input,
submit via `tac-btn` with cyan accent.

### Marketplace layout nav

Slim top bar in `app/marketplace/layout.tsx`:
- Left: `← Retour au moniteur` → `/monitor3d`
- Centre: `NAFAS · Marché des déchets`
- Right: `WalletConnect`

### Wallet connect state

When no wallet connected, action buttons replaced with inline `tac-panel` prompt:
`"Connectez votre portefeuille pour interagir"`. Dashboard and detail read-only
view are fully accessible without a wallet.

---

## Out of Scope (MVP)

- Batch editing or cancellation after listing
- Competing bids / auction mechanism
- Admin approval gate for listings
- IPFS for waste photos / certificates
- On-chain role enforcement (Supabase handles roles)
- Pagination (getAllBatches is fine at demo scale)
- Dispute resolution
