import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export interface BatchMetadata {
  batch_id:       bigint;
  user_id:        string | null;
  description:    string;
  photo_url:      string | null;
  location_label: string;
  created_at:     string;
}

export async function createBatchMetadata(data: {
  batch_id:       bigint;
  description:    string;
  photo_url:      string | null;
  location_label: string;
}): Promise<void> {
  const { error } = await supabase
    .from("waste_batch_metadata")
    .insert({ ...data, batch_id: String(data.batch_id) });
  if (error) throw new Error(error.message);
}

export async function getBatchMetadata(
  batchId: bigint,
): Promise<BatchMetadata | null> {
  const { data, error } = await supabase
    .from("waste_batch_metadata")
    .select("*")
    .eq("batch_id", String(batchId))
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // row not found
    throw new Error(error.message);
  }
  const raw = data as { batch_id: string; user_id: string | null; description: string; photo_url: string | null; location_label: string; created_at: string };
  return { ...raw, batch_id: BigInt(raw.batch_id) };
}

export async function listBatchesMetadata(
  ids: bigint[],
): Promise<BatchMetadata[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("waste_batch_metadata")
    .select("*")
    .in("batch_id", ids.map(String));
  if (error) throw new Error(error.message);
  const raw = (data ?? []) as Array<{ batch_id: string; user_id: string | null; description: string; photo_url: string | null; location_label: string; created_at: string }>;
  return raw.map((r) => ({ ...r, batch_id: BigInt(r.batch_id) }));
}
