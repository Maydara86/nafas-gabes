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
