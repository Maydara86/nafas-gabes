"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  // Stable ref so inline handlers don't change identity on re-render
  const cbRef = useRef(onEvent);
  useEffect(() => { cbRef.current = onEvent; });

  const onListed = useCallback((logs: unknown[]) => {
    (logs as Array<{ args: { id: bigint; factory: `0x${string}`; wasteType: string; quantity: bigint } }>)
      .forEach((l) => cbRef.current({ type: "listed", ...l.args, timestamp: Date.now() } as MarketplaceEvent));
  }, []);

  const onClaimed = useCallback((logs: unknown[]) => {
    (logs as Array<{ args: { id: bigint; claimer: `0x${string}` } }>)
      .forEach((l) => cbRef.current({ type: "claimed", ...l.args, timestamp: Date.now() } as MarketplaceEvent));
  }, []);

  const onCollected = useCallback((logs: unknown[]) => {
    (logs as Array<{ args: { id: bigint } }>)
      .forEach((l) => cbRef.current({ type: "collected", ...l.args, timestamp: Date.now() } as MarketplaceEvent));
  }, []);

  const onProcessed = useCallback((logs: unknown[]) => {
    (logs as Array<{ args: { id: bigint; outputType: string } }>)
      .forEach((l) => cbRef.current({ type: "processed", ...l.args, timestamp: Date.now() } as MarketplaceEvent));
  }, []);

  useWatchContractEvent({
    address: WASTE_MARKETPLACE_ADDRESS,
    abi: WASTE_MARKETPLACE_ABI,
    eventName: "BatchListed",
    onLogs: onListed,
  });
  useWatchContractEvent({
    address: WASTE_MARKETPLACE_ADDRESS,
    abi: WASTE_MARKETPLACE_ABI,
    eventName: "BatchClaimed",
    onLogs: onClaimed,
  });
  useWatchContractEvent({
    address: WASTE_MARKETPLACE_ADDRESS,
    abi: WASTE_MARKETPLACE_ABI,
    eventName: "BatchCollected",
    onLogs: onCollected,
  });
  useWatchContractEvent({
    address: WASTE_MARKETPLACE_ADDRESS,
    abi: WASTE_MARKETPLACE_ABI,
    eventName: "BatchProcessed",
    onLogs: onProcessed,
  });
}

// ── Re-export useAccount for convenience ────────────────────────────────
export { useAccount };
