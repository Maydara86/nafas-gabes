# Chemical Waste Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a blockchain-powered chemical waste marketplace on Base Sepolia where factories list waste batches, operators/recyclers claim them, and the public tracks all flows transparently.

**Architecture:** Foundry smart contract (`WasteMarketplace.sol`) deployed to Base Sepolia L2 testnet. Next.js frontend at `/marketplace` wired to the contract via wagmi v2 + viem. Batch metadata (description, photo, location label) stored in Supabase, linked to on-chain batches by `batchId`. WagmiProvider scoped to the marketplace layout — existing Cesium pages untouched.

**Tech Stack:** Foundry (Solidity 0.8.24), wagmi v2, viem v2, @tanstack/react-query v5, @supabase/supabase-js, Next.js 16, Tailwind 4, Zustand (not used here — wagmi manages chain state), NAFAS design tokens.

---

## File Map

**New files — contracts:**
- `contracts/foundry.toml` — Foundry project config
- `contracts/src/WasteMarketplace.sol` — main contract
- `contracts/test/WasteMarketplace.t.sol` — Forge tests
- `contracts/script/Deploy.s.sol` — deploy script

**New files — lib:**
- `lib/marketplace/contract.ts` — ABI, address constant, WasteBatch type
- `lib/marketplace/wagmiConfig.ts` — wagmi chain + transport config
- `lib/marketplace/supabase.ts` — Supabase client + metadata CRUD
- `lib/marketplace/hooks.ts` — wagmi hooks for all contract interactions

**New files — app:**
- `app/marketplace/providers.tsx` — WagmiProvider + QueryClientProvider (client component)
- `app/marketplace/layout.tsx` — layout wrapping providers
- `app/marketplace/page.tsx` — public read-only dashboard
- `app/marketplace/list/page.tsx` — factory batch listing form
- `app/marketplace/[id]/page.tsx` — batch detail + action buttons

**New files — components:**
- `components/marketplace/WalletConnect.tsx`
- `components/marketplace/StatusBadge.tsx`
- `components/marketplace/HazardIndicator.tsx`
- `components/marketplace/BatchCard.tsx`
- `components/marketplace/BatchGrid.tsx`
- `components/marketplace/ClaimButton.tsx`
- `components/marketplace/ConfirmCollectionButton.tsx`
- `components/marketplace/MarkProcessedForm.tsx`
- `components/marketplace/ListWasteForm.tsx`
- `components/marketplace/StatStrip.tsx`
- `components/marketplace/EventFeed.tsx`

**New files — supabase:**
- `supabase/migrations/20260418000000_waste_batch_metadata.sql`

**Modified files:**
- `.env.local` — add 5 new env vars (see Task 4)

---

## Task 1: Foundry Workspace Setup

**Files:**
- Create: `contracts/foundry.toml`
- Create: `contracts/src/.gitkeep`
- Create: `contracts/test/.gitkeep`
- Create: `contracts/script/.gitkeep`

- [ ] **Step 1: Install Foundry (if not already installed)**

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge --version
```

Expected output: `forge 0.x.x ...`

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p contracts/{src,test,script}
```

- [ ] **Step 3: Install forge-std (no git submodule)**

```bash
forge install foundry-rs/forge-std --no-git --root contracts/
```

Expected: `Installed forge-std` and `contracts/lib/forge-std/` created.

- [ ] **Step 4: Create `contracts/foundry.toml`**

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
remappings = ["forge-std/=lib/forge-std/src/"]

[rpc_endpoints]
base_sepolia = "${BASE_SEPOLIA_RPC_URL}"

[etherscan]
base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
```

- [ ] **Step 5: Verify build works with empty src**

```bash
forge build --root contracts/
```

Expected: `Nothing to compile.`

- [ ] **Step 6: Commit**

```bash
git add contracts/
git commit -m "chore(contracts): initialize Foundry workspace"
```

---

## Task 2: WasteMarketplace.sol — TDD

**Files:**
- Create: `contracts/test/WasteMarketplace.t.sol`
- Create: `contracts/src/WasteMarketplace.sol`

- [ ] **Step 1: Write the failing tests first**

Create `contracts/test/WasteMarketplace.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WasteMarketplace} from "../src/WasteMarketplace.sol";

contract WasteMarketplaceTest is Test {
    WasteMarketplace public marketplace;
    address factory = address(0x1);
    address claimer = address(0x2);

    function setUp() public {
        marketplace = new WasteMarketplace();
    }

    function test_listWaste_creates_batch() public {
        vm.prank(factory);
        uint256 id = marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");
        assertEq(id, 1);
        assertEq(marketplace.batchCount(), 1);
        WasteMarketplace.WasteBatch memory batch = marketplace.getBatch(1);
        assertEq(batch.factory, factory);
        assertEq(batch.wasteType, "phosphogypsum");
        assertEq(batch.quantity, 1000);
        assertEq(batch.hazardLevel, 3);
        assertEq(uint8(batch.status), uint8(WasteMarketplace.Status.LISTED));
        assertEq(batch.claimer, address(0));
    }

    function test_listWaste_reverts_on_zero_quantity() public {
        vm.prank(factory);
        vm.expectRevert("Quantity must be > 0");
        marketplace.listWaste("phosphogypsum", 0, 3, "33.9312,10.1178");
    }

    function test_listWaste_reverts_on_zero_hazard() public {
        vm.prank(factory);
        vm.expectRevert("Hazard level 1-5");
        marketplace.listWaste("phosphogypsum", 1000, 0, "33.9312,10.1178");
    }

    function test_listWaste_reverts_on_hazard_above_5() public {
        vm.prank(factory);
        vm.expectRevert("Hazard level 1-5");
        marketplace.listWaste("phosphogypsum", 1000, 6, "33.9312,10.1178");
    }

    function test_listWaste_emits_BatchListed() public {
        vm.prank(factory);
        vm.expectEmit(true, true, false, true);
        emit WasteMarketplace.BatchListed(1, factory, "fluoride", 500);
        marketplace.listWaste("fluoride", 500, 4, "33.9300,10.1200");
    }

    function test_claimWaste_sets_claimer_and_status() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");

        vm.prank(claimer);
        marketplace.claimWaste(1);

        WasteMarketplace.WasteBatch memory batch = marketplace.getBatch(1);
        assertEq(batch.claimer, claimer);
        assertEq(uint8(batch.status), uint8(WasteMarketplace.Status.CLAIMED));
    }

    function test_claimWaste_reverts_if_factory_claims_own() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");

        vm.prank(factory);
        vm.expectRevert("Factory cannot claim own batch");
        marketplace.claimWaste(1);
    }

    function test_claimWaste_reverts_if_not_listed() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");
        vm.prank(claimer);
        marketplace.claimWaste(1);

        vm.prank(address(0x3));
        vm.expectRevert("Not available");
        marketplace.claimWaste(1);
    }

    function test_claimWaste_reverts_on_nonexistent_batch() public {
        vm.prank(claimer);
        vm.expectRevert("Batch does not exist");
        marketplace.claimWaste(99);
    }

    function test_confirmCollection_only_factory() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");
        vm.prank(claimer);
        marketplace.claimWaste(1);

        vm.prank(claimer);
        vm.expectRevert("Only factory can confirm");
        marketplace.confirmCollection(1);

        vm.prank(factory);
        marketplace.confirmCollection(1);
        assertEq(
            uint8(marketplace.getBatch(1).status),
            uint8(WasteMarketplace.Status.COLLECTED)
        );
    }

    function test_confirmCollection_reverts_if_not_claimed() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");

        vm.prank(factory);
        vm.expectRevert("Not claimed yet");
        marketplace.confirmCollection(1);
    }

    function test_markProcessed_only_claimer() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");
        vm.prank(claimer);
        marketplace.claimWaste(1);
        vm.prank(factory);
        marketplace.confirmCollection(1);

        vm.prank(factory);
        vm.expectRevert("Only claimer can mark processed");
        marketplace.markProcessed(1, "algae");

        vm.prank(claimer);
        marketplace.markProcessed(1, "algae");

        WasteMarketplace.WasteBatch memory batch = marketplace.getBatch(1);
        assertEq(uint8(batch.status), uint8(WasteMarketplace.Status.PROCESSED));
        assertEq(batch.outputType, "algae");
    }

    function test_markProcessed_reverts_if_not_collected() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");
        vm.prank(claimer);
        marketplace.claimWaste(1);

        vm.prank(claimer);
        vm.expectRevert("Not collected yet");
        marketplace.markProcessed(1, "algae");
    }

    function test_getAllBatches_returns_all() public {
        vm.startPrank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");
        marketplace.listWaste("fluoride", 500, 4, "33.9300,10.1200");
        vm.stopPrank();

        WasteMarketplace.WasteBatch[] memory all = marketplace.getAllBatches();
        assertEq(all.length, 2);
        assertEq(all[0].wasteType, "phosphogypsum");
        assertEq(all[1].wasteType, "fluoride");
    }

    function test_getAllBatches_empty_initially() public view {
        WasteMarketplace.WasteBatch[] memory all = marketplace.getAllBatches();
        assertEq(all.length, 0);
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail (contract not yet written)**

```bash
forge test --root contracts/ -v
```

Expected: compilation error — `WasteMarketplace` not found.

- [ ] **Step 3: Write the contract**

Create `contracts/src/WasteMarketplace.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract WasteMarketplace {
    enum Status { LISTED, CLAIMED, COLLECTED, PROCESSED }

    struct WasteBatch {
        uint256 id;
        address factory;
        address claimer;
        string wasteType;
        uint256 quantity;
        uint8 hazardLevel;
        string location;
        Status status;
        string outputType;
        uint256 listedAt;
    }

    mapping(uint256 => WasteBatch) public batches;
    uint256 public batchCount;

    event BatchListed(uint256 indexed id, address indexed factory, string wasteType, uint256 quantity);
    event BatchClaimed(uint256 indexed id, address indexed claimer);
    event BatchCollected(uint256 indexed id);
    event BatchProcessed(uint256 indexed id, string outputType);

    function listWaste(
        string calldata wasteType,
        uint256 quantity,
        uint8 hazardLevel,
        string calldata location
    ) external returns (uint256) {
        require(quantity > 0, "Quantity must be > 0");
        require(hazardLevel >= 1 && hazardLevel <= 5, "Hazard level 1-5");

        uint256 id = ++batchCount;
        batches[id] = WasteBatch({
            id: id,
            factory: msg.sender,
            claimer: address(0),
            wasteType: wasteType,
            quantity: quantity,
            hazardLevel: hazardLevel,
            location: location,
            status: Status.LISTED,
            outputType: "",
            listedAt: block.timestamp
        });

        emit BatchListed(id, msg.sender, wasteType, quantity);
        return id;
    }

    function claimWaste(uint256 batchId) external {
        WasteBatch storage batch = batches[batchId];
        require(batch.id != 0, "Batch does not exist");
        require(batch.status == Status.LISTED, "Not available");
        require(batch.factory != msg.sender, "Factory cannot claim own batch");

        batch.claimer = msg.sender;
        batch.status = Status.CLAIMED;

        emit BatchClaimed(batchId, msg.sender);
    }

    function confirmCollection(uint256 batchId) external {
        WasteBatch storage batch = batches[batchId];
        require(batch.id != 0, "Batch does not exist");
        require(batch.status == Status.CLAIMED, "Not claimed yet");
        require(batch.factory == msg.sender, "Only factory can confirm");

        batch.status = Status.COLLECTED;

        emit BatchCollected(batchId);
    }

    function markProcessed(uint256 batchId, string calldata outputType) external {
        WasteBatch storage batch = batches[batchId];
        require(batch.id != 0, "Batch does not exist");
        require(batch.status == Status.COLLECTED, "Not collected yet");
        require(batch.claimer == msg.sender, "Only claimer can mark processed");

        batch.outputType = outputType;
        batch.status = Status.PROCESSED;

        emit BatchProcessed(batchId, outputType);
    }

    function getBatch(uint256 id) external view returns (WasteBatch memory) {
        return batches[id];
    }

    function getAllBatches() external view returns (WasteBatch[] memory) {
        WasteBatch[] memory result = new WasteBatch[](batchCount);
        for (uint256 i = 1; i <= batchCount; i++) {
            result[i - 1] = batches[i];
        }
        return result;
    }
}
```

- [ ] **Step 4: Run tests to confirm they all pass**

```bash
forge test --root contracts/ -v
```

Expected output: all 14 tests pass with `[PASS]`.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/WasteMarketplace.sol contracts/test/WasteMarketplace.t.sol
git commit -m "feat(contracts): WasteMarketplace with full Forge test suite"
```

---

## Task 3: Deploy Script + Base Sepolia Deployment

**Files:**
- Create: `contracts/script/Deploy.s.sol`

- [ ] **Step 1: Create the deploy script**

Create `contracts/script/Deploy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {WasteMarketplace} from "../src/WasteMarketplace.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        WasteMarketplace marketplace = new WasteMarketplace();
        console.log("WasteMarketplace deployed at:", address(marketplace));

        vm.stopBroadcast();
    }
}
```

- [ ] **Step 2: Get a funded Base Sepolia wallet**

Go to https://www.coinbase.com/faucets/base-ethereum-goerli-faucet and request test ETH for your deployer address. Alternatively use the Superchain faucet: https://app.optimism.io/faucet

Check balance with:
```bash
cast balance <YOUR_DEPLOYER_ADDRESS> --rpc-url https://sepolia.base.org
```

Expected: at least `0.01 ether`

- [ ] **Step 3: Add env vars to `.env.local`**

Append to `.env.local` (create if it doesn't exist):

```bash
# Contracts — Base Sepolia deployment
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
DEPLOYER_PRIVATE_KEY=0x<your_deployer_private_key>
BASESCAN_API_KEY=<your_basescan_api_key>

# Filled after deploy in Step 4:
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

⚠️ Never commit `.env.local` — it's already in `.gitignore`.

- [ ] **Step 4: Deploy to Base Sepolia**

```bash
forge script contracts/script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --root contracts/
```

Expected: `WasteMarketplace deployed at: 0x<address>`

Copy the deployed address and fill in `NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env.local`.

- [ ] **Step 5: Verify on Basescan (optional but useful for demo)**

```bash
forge verify-contract <DEPLOYED_ADDRESS> contracts/src/WasteMarketplace.sol:WasteMarketplace \
  --chain base-sepolia \
  --root contracts/
```

Expected: `Contract successfully verified.`

- [ ] **Step 6: Commit**

```bash
git add contracts/script/Deploy.s.sol
git commit -m "feat(contracts): add Deploy script for Base Sepolia"
```

---

## Task 4: Install npm Dependencies

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install wagmi, viem, react-query, supabase**

```bash
npm install wagmi@^2 viem@^2 @wagmi/core@^2 @tanstack/react-query@^5 @supabase/supabase-js@^2
```

- [ ] **Step 2: Add Supabase env vars to `.env.local`**

Append to `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

To get these: create a project at https://supabase.com (free), then go to Project Settings → API.

- [ ] **Step 3: Verify dev server still starts**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000` with no errors. Open `/` to confirm landing page renders.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install wagmi, viem, react-query, supabase-js"
```

---

## Task 5: lib/marketplace/contract.ts

**Files:**
- Create: `lib/marketplace/contract.ts`

- [ ] **Step 1: Write the file**

Create `lib/marketplace/contract.ts`:

```typescript
import type { Address } from "viem";

export const WASTE_MARKETPLACE_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Address;

export const WASTE_MARKETPLACE_ABI = [
  // ── Events ────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "BatchListed",
    inputs: [
      { name: "id",        type: "uint256", indexed: true  },
      { name: "factory",   type: "address", indexed: true  },
      { name: "wasteType", type: "string",  indexed: false },
      { name: "quantity",  type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BatchClaimed",
    inputs: [
      { name: "id",      type: "uint256", indexed: true },
      { name: "claimer", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "BatchCollected",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "BatchProcessed",
    inputs: [
      { name: "id",         type: "uint256", indexed: true  },
      { name: "outputType", type: "string",  indexed: false },
    ],
  },
  // ── Read ──────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "batchCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getBatch",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id",          type: "uint256" },
          { name: "factory",     type: "address" },
          { name: "claimer",     type: "address" },
          { name: "wasteType",   type: "string"  },
          { name: "quantity",    type: "uint256" },
          { name: "hazardLevel", type: "uint8"   },
          { name: "location",    type: "string"  },
          { name: "status",      type: "uint8"   },
          { name: "outputType",  type: "string"  },
          { name: "listedAt",    type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getAllBatches",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "id",          type: "uint256" },
          { name: "factory",     type: "address" },
          { name: "claimer",     type: "address" },
          { name: "wasteType",   type: "string"  },
          { name: "quantity",    type: "uint256" },
          { name: "hazardLevel", type: "uint8"   },
          { name: "location",    type: "string"  },
          { name: "status",      type: "uint8"   },
          { name: "outputType",  type: "string"  },
          { name: "listedAt",    type: "uint256" },
        ],
      },
    ],
  },
  // ── Write ─────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "listWaste",
    stateMutability: "nonpayable",
    inputs: [
      { name: "wasteType",   type: "string"  },
      { name: "quantity",    type: "uint256" },
      { name: "hazardLevel", type: "uint8"   },
      { name: "location",    type: "string"  },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "claimWaste",
    stateMutability: "nonpayable",
    inputs: [{ name: "batchId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "confirmCollection",
    stateMutability: "nonpayable",
    inputs: [{ name: "batchId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "markProcessed",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchId",    type: "uint256" },
      { name: "outputType", type: "string"  },
    ],
    outputs: [],
  },
] as const;

// ── TypeScript types ────────────────────────────────────────────────────
export const BatchStatus = {
  LISTED:    0,
  CLAIMED:   1,
  COLLECTED: 2,
  PROCESSED: 3,
} as const;

export type BatchStatusValue = (typeof BatchStatus)[keyof typeof BatchStatus];

export interface WasteBatch {
  id:          bigint;
  factory:     `0x${string}`;
  claimer:     `0x${string}`;
  wasteType:   string;
  quantity:    bigint;
  hazardLevel: number;
  location:    string;
  status:      BatchStatusValue;
  outputType:  string;
  listedAt:    bigint;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/marketplace/contract.ts
git commit -m "feat(marketplace): contract ABI, address constant, WasteBatch types"
```

---

## Task 6: lib/marketplace/wagmiConfig.ts

**Files:**
- Create: `lib/marketplace/wagmiConfig.ts`

- [ ] **Step 1: Write the file**

Create `lib/marketplace/wagmiConfig.ts`:

```typescript
import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(),   // catches MetaMask, Rabby, Coinbase Wallet browser extension
    metaMask(),   // explicit MetaMask deep-link for mobile
  ],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add lib/marketplace/wagmiConfig.ts
git commit -m "feat(marketplace): wagmi config for Base Sepolia"
```

---

## Task 7: Supabase Migration + lib/marketplace/supabase.ts

**Files:**
- Create: `supabase/migrations/20260418000000_waste_batch_metadata.sql`
- Create: `lib/marketplace/supabase.ts`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260418000000_waste_batch_metadata.sql`:

```sql
create table if not exists waste_batch_metadata (
  batch_id       bigint      primary key,
  user_id        uuid        references auth.users on delete set null,
  description    text        not null default '',
  photo_url      text,
  location_label text        not null default '',
  created_at     timestamptz not null default now()
);

alter table waste_batch_metadata enable row level security;

-- Public can read all metadata (dashboard is public)
create policy "public_read"
  on waste_batch_metadata
  for select
  using (true);

-- Authenticated users can insert their own rows
create policy "auth_insert"
  on waste_batch_metadata
  for insert
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Apply the migration to your local/remote Supabase project**

If using Supabase CLI:
```bash
npx supabase db push
```

If applying manually: go to Supabase Dashboard → SQL Editor → paste the SQL above → Run.

- [ ] **Step 3: Write lib/marketplace/supabase.ts**

Create `lib/marketplace/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export interface BatchMetadata {
  batch_id:       number;
  user_id:        string | null;
  description:    string;
  photo_url:      string | null;
  location_label: string;
  created_at:     string;
}

export async function createBatchMetadata(data: {
  batch_id:       number;
  description:    string;
  photo_url:      string | null;
  location_label: string;
}): Promise<void> {
  const { error } = await supabase
    .from("waste_batch_metadata")
    .insert(data);
  if (error) throw new Error(error.message);
}

export async function getBatchMetadata(
  batchId: number,
): Promise<BatchMetadata | null> {
  const { data, error } = await supabase
    .from("waste_batch_metadata")
    .select("*")
    .eq("batch_id", batchId)
    .single();
  if (error) return null;
  return data as BatchMetadata;
}

export async function listBatchesMetadata(
  ids: number[],
): Promise<BatchMetadata[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("waste_batch_metadata")
    .select("*")
    .in("batch_id", ids);
  if (error) return [];
  return (data ?? []) as BatchMetadata[];
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260418000000_waste_batch_metadata.sql lib/marketplace/supabase.ts
git commit -m "feat(marketplace): Supabase migration + metadata CRUD"
```

---

## Task 8: lib/marketplace/hooks.ts

**Files:**
- Create: `lib/marketplace/hooks.ts`

- [ ] **Step 1: Write the file**

Create `lib/marketplace/hooks.ts`:

```typescript
"use client";

import { useState } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useAccount,
} from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { parseEventLogs } from "viem";
import {
  WASTE_MARKETPLACE_ABI,
  WASTE_MARKETPLACE_ADDRESS,
  type WasteBatch,
} from "./contract";
import { wagmiConfig } from "./wagmiConfig";

// ── Read hooks ──────────────────────────────────────────────────────────

export function useAllBatches() {
  return useReadContract({
    address: WASTE_MARKETPLACE_ADDRESS,
    abi: WASTE_MARKETPLACE_ABI,
    functionName: "getAllBatches",
    query: { refetchInterval: 12_000 }, // ~1 Base Sepolia block
  }) as { data: WasteBatch[] | undefined; isLoading: boolean; error: Error | null };
}

export function useBatch(id: bigint | undefined) {
  return useReadContract({
    address: WASTE_MARKETPLACE_ADDRESS,
    abi: WASTE_MARKETPLACE_ABI,
    functionName: "getBatch",
    args: id !== undefined ? [id] : undefined,
    query: { enabled: id !== undefined, refetchInterval: 8_000 },
  }) as { data: WasteBatch | undefined; isLoading: boolean; error: Error | null };
}

// ── listWaste — async so we can extract batchId from the event log ──────

export function useListWaste() {
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function listWaste(params: {
    wasteType:   string;
    quantity:    bigint;
    hazardLevel: number;
    location:    string;
  }): Promise<bigint> {
    setIsPending(true);
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: WASTE_MARKETPLACE_ADDRESS,
        abi: WASTE_MARKETPLACE_ABI,
        functionName: "listWaste",
        args: [params.wasteType, params.quantity, params.hazardLevel, params.location],
      });

      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });

      const logs = parseEventLogs({
        abi: WASTE_MARKETPLACE_ABI,
        logs: receipt.logs,
        eventName: "BatchListed",
      });

      if (logs.length === 0) throw new Error("BatchListed event not found in receipt");
      return logs[0].args.id;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  }

  return { listWaste, isPending, error };
}

// ── claimWaste ──────────────────────────────────────────────────────────

export function useClaimWaste() {
  const { writeContract, isPending: isWritePending } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function claimWaste(batchId: bigint) {
    writeContract(
      {
        address: WASTE_MARKETPLACE_ADDRESS,
        abi: WASTE_MARKETPLACE_ABI,
        functionName: "claimWaste",
        args: [batchId],
      },
      { onSuccess: (h) => setHash(h) },
    );
  }

  return { claimWaste, isPending: isWritePending || isConfirming, isSuccess };
}

// ── confirmCollection ───────────────────────────────────────────────────

export function useConfirmCollection() {
  const { writeContract, isPending: isWritePending } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function confirmCollection(batchId: bigint) {
    writeContract(
      {
        address: WASTE_MARKETPLACE_ADDRESS,
        abi: WASTE_MARKETPLACE_ABI,
        functionName: "confirmCollection",
        args: [batchId],
      },
      { onSuccess: (h) => setHash(h) },
    );
  }

  return { confirmCollection, isPending: isWritePending || isConfirming, isSuccess };
}

// ── markProcessed ───────────────────────────────────────────────────────

export function useMarkProcessed() {
  const { writeContract, isPending: isWritePending } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function markProcessed(batchId: bigint, outputType: string) {
    writeContract(
      {
        address: WASTE_MARKETPLACE_ADDRESS,
        abi: WASTE_MARKETPLACE_ABI,
        functionName: "markProcessed",
        args: [batchId, outputType],
      },
      { onSuccess: (h) => setHash(h) },
    );
  }

  return { markProcessed, isPending: isWritePending || isConfirming, isSuccess };
}

// ── Live event feed ─────────────────────────────────────────────────────

export type MarketplaceEvent =
  | { type: "listed";    id: bigint; factory: `0x${string}`; wasteType: string; quantity: bigint; timestamp: number }
  | { type: "claimed";   id: bigint; claimer: `0x${string}`; timestamp: number }
  | { type: "collected"; id: bigint; timestamp: number }
  | { type: "processed"; id: bigint; outputType: string; timestamp: number };

export function useMarketplaceEvents(onEvent: (e: MarketplaceEvent) => void) {
  useWatchContractEvent({
    address: WASTE_MARKETPLACE_ADDRESS,
    abi: WASTE_MARKETPLACE_ABI,
    eventName: "BatchListed",
    onLogs: (logs) => logs.forEach((l) =>
      onEvent({ type: "listed", ...l.args, timestamp: Date.now() } as MarketplaceEvent)
    ),
  });
  useWatchContractEvent({
    address: WASTE_MARKETPLACE_ADDRESS,
    abi: WASTE_MARKETPLACE_ABI,
    eventName: "BatchClaimed",
    onLogs: (logs) => logs.forEach((l) =>
      onEvent({ type: "claimed", ...l.args, timestamp: Date.now() } as MarketplaceEvent)
    ),
  });
  useWatchContractEvent({
    address: WASTE_MARKETPLACE_ADDRESS,
    abi: WASTE_MARKETPLACE_ABI,
    eventName: "BatchCollected",
    onLogs: (logs) => logs.forEach((l) =>
      onEvent({ type: "collected", ...l.args, timestamp: Date.now() } as MarketplaceEvent)
    ),
  });
  useWatchContractEvent({
    address: WASTE_MARKETPLACE_ADDRESS,
    abi: WASTE_MARKETPLACE_ABI,
    eventName: "BatchProcessed",
    onLogs: (logs) => logs.forEach((l) =>
      onEvent({ type: "processed", ...l.args, timestamp: Date.now() } as MarketplaceEvent)
    ),
  });
}

// ── Re-export useAccount for convenience ────────────────────────────────
export { useAccount };
```

- [ ] **Step 2: Commit**

```bash
git add lib/marketplace/hooks.ts
git commit -m "feat(marketplace): wagmi read/write hooks + live event feed"
```

---

## Task 9: Marketplace Providers + Layout

**Files:**
- Create: `app/marketplace/providers.tsx`
- Create: `app/marketplace/layout.tsx`

- [ ] **Step 1: Create `app/marketplace/providers.tsx`**

```typescript
"use client";

import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/marketplace/wagmiConfig";

export function MarketplaceProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

- [ ] **Step 2: Create `app/marketplace/layout.tsx`**

```typescript
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
```

- [ ] **Step 3: Verify the layout renders**

```bash
npm run dev
```

Open `http://localhost:3000/marketplace` — you should see the nav bar and no errors in console. (Page body will be empty until we add `page.tsx`.)

- [ ] **Step 4: Commit**

```bash
git add app/marketplace/providers.tsx app/marketplace/layout.tsx
git commit -m "feat(marketplace): layout with scoped WagmiProvider"
```

---

## Task 10: Leaf Components — WalletConnect, StatusBadge, HazardIndicator

**Files:**
- Create: `components/marketplace/WalletConnect.tsx`
- Create: `components/marketplace/StatusBadge.tsx`
- Create: `components/marketplace/HazardIndicator.tsx`

- [ ] **Step 1: Create `components/marketplace/WalletConnect.tsx`**

```typescript
"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="tac-label text-[8.5px] text-[color:var(--nafas-accent2)]">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="tac-btn"
        >
          Déconnecter
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          type="button"
          disabled={isPending}
          onClick={() => connect({ connector })}
          className="tac-btn"
          data-active={isPending ? "true" : undefined}
        >
          {isPending ? "Connexion…" : connector.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/marketplace/StatusBadge.tsx`**

```typescript
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
```

- [ ] **Step 3: Create `components/marketplace/HazardIndicator.tsx`**

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add components/marketplace/WalletConnect.tsx \
        components/marketplace/StatusBadge.tsx \
        components/marketplace/HazardIndicator.tsx
git commit -m "feat(marketplace): WalletConnect, StatusBadge, HazardIndicator"
```

---

## Task 11: BatchCard + BatchGrid

**Files:**
- Create: `components/marketplace/BatchCard.tsx`
- Create: `components/marketplace/BatchGrid.tsx`

- [ ] **Step 1: Create `components/marketplace/BatchCard.tsx`**

```typescript
import Link from "next/link";
import { BatchStatus, type WasteBatch } from "@/lib/marketplace/contract";
import type { BatchMetadata } from "@/lib/marketplace/supabase";
import { StatusBadge } from "./StatusBadge";
import { HazardIndicator } from "./HazardIndicator";

const STATUS_STRIPE_COLOR: Record<number, string> = {
  [BatchStatus.LISTED]:    "var(--nafas-cyan)",
  [BatchStatus.CLAIMED]:   "var(--nafas-amber)",
  [BatchStatus.COLLECTED]: "var(--nafas-blue)",
  [BatchStatus.PROCESSED]: "var(--nafas-accent2)",
};

interface BatchCardProps {
  batch:    WasteBatch;
  metadata: BatchMetadata | null;
}

export function BatchCard({ batch, metadata }: BatchCardProps) {
  const stripeColor = STATUS_STRIPE_COLOR[batch.status];

  return (
    <Link href={`/marketplace/${batch.id}`} className="block group">
      <div className="tac-panel relative overflow-hidden hover:border-white/20 transition-colors">
        {/* left status stripe */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{
            background: stripeColor,
            boxShadow: `0 0 10px -1px ${stripeColor}`,
          }}
        />

        <div className="pl-4 pr-3 py-3 space-y-2">
          {/* row 1 — type + status */}
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[13px] font-medium truncate"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
            >
              {batch.wasteType}
            </span>
            <StatusBadge status={batch.status} />
          </div>

          {/* row 2 — quantity + hazard */}
          <div className="flex items-center gap-4">
            <div>
              <span className="tac-label text-[8px] block mb-0.5">QUANTITÉ</span>
              <span className="tac-readout text-[12px]">
                {Number(batch.quantity).toLocaleString("fr-FR")} kg
              </span>
            </div>
            <div>
              <span className="tac-label text-[8px] block mb-0.5">DANGER</span>
              <HazardIndicator level={batch.hazardLevel} />
            </div>
          </div>

          {/* row 3 — location label or GPS */}
          <div className="tac-label text-[8.5px] text-[color:var(--nafas-ink3)]/80 truncate">
            {metadata?.location_label ?? batch.location}
          </div>

          {/* row 4 — description (if any) */}
          {metadata?.description && (
            <div
              className="text-[11px] text-[color:var(--nafas-ink3)] line-clamp-2"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {metadata.description}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create `components/marketplace/BatchGrid.tsx`**

```typescript
import type { WasteBatch } from "@/lib/marketplace/contract";
import type { BatchMetadata } from "@/lib/marketplace/supabase";
import { BatchCard } from "./BatchCard";

interface BatchGridProps {
  batches:   WasteBatch[];
  metaMap:   Map<bigint, BatchMetadata>;
}

export function BatchGrid({ batches, metaMap }: BatchGridProps) {
  if (batches.length === 0) {
    return (
      <div className="tac-panel px-6 py-10 text-center">
        <span className="tac-label text-[color:var(--nafas-ink3)]/60">
          Aucun lot listé pour le moment
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {batches.map((batch) => (
        <BatchCard
          key={String(batch.id)}
          batch={batch}
          metadata={metaMap.get(batch.id) ?? null}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/marketplace/BatchCard.tsx components/marketplace/BatchGrid.tsx
git commit -m "feat(marketplace): BatchCard and BatchGrid components"
```

---

## Task 12: Action Components — Claim, Confirm, MarkProcessed

**Files:**
- Create: `components/marketplace/ClaimButton.tsx`
- Create: `components/marketplace/ConfirmCollectionButton.tsx`
- Create: `components/marketplace/MarkProcessedForm.tsx`

- [ ] **Step 1: Create `components/marketplace/ClaimButton.tsx`**

```typescript
"use client";

import { useClaimWaste } from "@/lib/marketplace/hooks";

export function ClaimButton({
  batchId,
  onSuccess,
}: {
  batchId: bigint;
  onSuccess?: () => void;
}) {
  const { claimWaste, isPending, isSuccess } = useClaimWaste();

  if (isSuccess) {
    return (
      <div className="tac-panel px-4 py-3 text-center">
        <span className="tac-label text-[color:var(--nafas-accent2)]">
          ✓ Lot réclamé — en attente de confirmation usine
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        claimWaste(batchId);
        if (onSuccess) onSuccess();
      }}
      className="tac-btn w-full justify-center py-3"
      data-active={isPending ? "true" : undefined}
    >
      {isPending ? "Transaction en cours…" : "Réclamer ce lot"}
    </button>
  );
}
```

- [ ] **Step 2: Create `components/marketplace/ConfirmCollectionButton.tsx`**

```typescript
"use client";

import { useConfirmCollection } from "@/lib/marketplace/hooks";

export function ConfirmCollectionButton({ batchId }: { batchId: bigint }) {
  const { confirmCollection, isPending, isSuccess } = useConfirmCollection();

  if (isSuccess) {
    return (
      <div className="tac-panel px-4 py-3 text-center">
        <span className="tac-label text-[color:var(--nafas-accent2)]">
          ✓ Collecte confirmée
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => confirmCollection(batchId)}
      className="tac-btn w-full justify-center py-3"
      data-active={isPending ? "true" : undefined}
    >
      {isPending ? "Transaction en cours…" : "Confirmer la collecte"}
    </button>
  );
}
```

- [ ] **Step 3: Create `components/marketplace/MarkProcessedForm.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useMarkProcessed } from "@/lib/marketplace/hooks";

const OUTPUT_TYPES = [
  "Système à algues — purification de l'air",
  "Engrais recyclé",
  "Matériau d'emballage",
  "Fibre textile",
  "Autre",
];

export function MarkProcessedForm({ batchId }: { batchId: bigint }) {
  const [outputType, setOutputType] = useState(OUTPUT_TYPES[0]);
  const { markProcessed, isPending, isSuccess } = useMarkProcessed();

  if (isSuccess) {
    return (
      <div className="tac-panel px-4 py-3 text-center">
        <span className="tac-label text-[color:var(--nafas-accent2)]">
          ✓ Traitement enregistré
        </span>
      </div>
    );
  }

  return (
    <div className="tac-panel p-4 space-y-3">
      <span className="tac-bracket">Marquer comme traité</span>
      <div>
        <label className="tac-label block mb-1.5">TYPE DE SORTIE</label>
        <select
          value={outputType}
          onChange={(e) => setOutputType(e.target.value)}
          className="w-full tac-btn text-left"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          {OUTPUT_TYPES.map((t) => (
            <option key={t} value={t} style={{ background: "var(--nafas-bg2)" }}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => markProcessed(batchId, outputType)}
        className="tac-btn w-full justify-center py-3"
        data-active={isPending ? "true" : undefined}
      >
        {isPending ? "Transaction en cours…" : "Enregistrer le traitement"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/marketplace/ClaimButton.tsx \
        components/marketplace/ConfirmCollectionButton.tsx \
        components/marketplace/MarkProcessedForm.tsx
git commit -m "feat(marketplace): Claim, ConfirmCollection, MarkProcessed action components"
```

---

## Task 13: ListWasteForm

**Files:**
- Create: `components/marketplace/ListWasteForm.tsx`

- [ ] **Step 1: Create `components/marketplace/ListWasteForm.tsx`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add components/marketplace/ListWasteForm.tsx
git commit -m "feat(marketplace): ListWasteForm with on-chain + Supabase submission"
```

---

## Task 14: StatStrip + EventFeed

**Files:**
- Create: `components/marketplace/StatStrip.tsx`
- Create: `components/marketplace/EventFeed.tsx`

- [ ] **Step 1: Create `components/marketplace/StatStrip.tsx`**

```typescript
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
```

- [ ] **Step 2: Create `components/marketplace/EventFeed.tsx`**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add components/marketplace/StatStrip.tsx components/marketplace/EventFeed.tsx
git commit -m "feat(marketplace): StatStrip and live EventFeed"
```

---

## Task 15: app/marketplace/page.tsx — Public Dashboard

**Files:**
- Create: `app/marketplace/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/marketplace/page.tsx`:

```typescript
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
    const ids = batches.map((b) => Number(b.id));
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
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000/marketplace`. Expected:
- Nav bar with "Retour au moniteur" + "NAFAS · MARCHÉ DES DÉCHETS"
- Stat strip (all zeros if contract is empty)
- Empty batch grid with "Aucun lot listé" message
- Live event feed sidebar with "En attente d'événements on-chain…"
- No console errors

- [ ] **Step 3: Commit**

```bash
git add app/marketplace/page.tsx
git commit -m "feat(marketplace): public dashboard with BatchGrid + EventFeed"
```

---

## Task 16: app/marketplace/list/page.tsx — Factory Listing Form

**Files:**
- Create: `app/marketplace/list/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/marketplace/list/page.tsx`:

```typescript
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
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000/marketplace/list`. Expected:
- Title + subtitle
- If no wallet connected: "Connectez votre portefeuille" prompt with connect button
- After connecting: full form rendered
- No console errors

- [ ] **Step 3: End-to-end test of the listing flow**

1. Connect MetaMask to Base Sepolia (Chain ID 84532)
2. Fill the form: any waste type, quantity 1000, hazard 3, default GPS
3. Submit — MetaMask prompts for signature
4. After tx confirms → redirected to `/marketplace/1`
5. Back on `/marketplace` → batch appears in the grid

- [ ] **Step 4: Commit**

```bash
git add app/marketplace/list/page.tsx
git commit -m "feat(marketplace): factory waste listing page"
```

---

## Task 17: app/marketplace/[id]/page.tsx — Batch Detail + Actions

**Files:**
- Create: `app/marketplace/[id]/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/marketplace/[id]/page.tsx`:

```typescript
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
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000/marketplace/1` (after listing at least one batch).

Expected:
- Batch details rendered: type, quantity, hazard indicator, GPS, status badge
- If connected as factory → no action shown while LISTED (can't claim own batch); once claimed, "Confirmer la collecte" appears
- If connected as claimer → "Réclamer ce lot" shown on LISTED batch
- "Voir le contrat ↗" links to Basescan
- Full flow: list → claim → confirm → markProcessed all work end-to-end

- [ ] **Step 3: Commit**

```bash
git add app/marketplace/[id]/page.tsx
git commit -m "feat(marketplace): batch detail page with context-aware actions"
```

---

## Self-Review Checklist (run before handoff)

- [ ] `forge test --root contracts/` → all 14 tests pass
- [ ] `npm run build` passes — if it fails with ESM errors on wagmi/viem, add this to `next.config.ts` inside the `nextConfig` object: `transpilePackages: ["wagmi", "viem", "@wagmi/core"]`
- [ ] `/marketplace` renders without wallet connected (read-only public view works)
- [ ] `/marketplace/list` shows WalletConnect prompt when no wallet
- [ ] Full happy path works on Base Sepolia: list → claim → confirm → markProcessed
- [ ] Batch detail "Voir le contrat ↗" links to correct Basescan address
- [ ] `NEXT_PUBLIC_CONTRACT_ADDRESS` is set in `.env.local`
