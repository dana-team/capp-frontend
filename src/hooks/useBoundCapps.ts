import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBoundCapps } from "@/api/bound";
import { BoundCappsResponse, BoundResourceKind } from "@/types/bound";
import { useAuthStore } from "@/store/auth";
import { getBackendUrl } from "@/lib/config";

/** Prefix of every bound-capps query on a cluster; Capp and resource writes refresh it. */
export const boundCappsPrefix = (cluster: string) => ["bound-capps", getBackendUrl(), cluster];

const boundCappsKey = (cluster: string, kind: BoundResourceKind, namespace: string, name: string) =>
  [...boundCappsPrefix(cluster), kind, namespace, name];

export function useBoundCapps(
  kind: BoundResourceKind,
  namespace: string,
  name: string,
  enabled = true,
) {
  const cluster = useAuthStore((s) => s.cluster);
  return useQuery({
    queryKey: boundCappsKey(cluster, kind, namespace, name),
    queryFn: () => getBoundCapps(cluster, kind, namespace, name),
    enabled: enabled && Boolean(cluster && namespace && name),
  });
}

/** What the save confirmation shows: the bound Capps fetched at submit, or why that fetch failed. */
export type BoundSaveCheck<T> =
  | { values: T; bound: BoundCappsResponse; error?: undefined }
  | { values: T; bound?: undefined; error: Error };

/**
 * Guards saving a Secret or ConfigMap. Each submit fetches the bound Capps afresh,
 * since a cached or polled result can be stale and a Capp may have started using
 * the resource since. Saves straight away only when that fetch confirms no Capp
 * uses it; otherwise, including when the fetch fails, it asks first.
 */
export function useBoundSaveGuard<T>(
  kind: BoundResourceKind,
  namespace: string,
  name: string,
  save: (values: T) => Promise<void>,
) {
  const queryClient = useQueryClient();
  const cluster = useAuthStore((s) => s.cluster);
  const [isChecking, setIsChecking] = useState(false);
  const [check, setCheck] = useState<BoundSaveCheck<T> | null>(null);

  const handleSubmit = async (values: T) => {
    let bound: BoundCappsResponse;
    setIsChecking(true);
    try {
      bound = await queryClient.fetchQuery({
        queryKey: boundCappsKey(cluster, kind, namespace, name),
        queryFn: () => getBoundCapps(cluster, kind, namespace, name),
        staleTime: 0,
      });
    } catch (e) {
      setCheck({ values, error: e instanceof Error ? e : new Error(String(e)) });
      return;
    } finally {
      setIsChecking(false);
    }
    if (bound.boundCapps.length === 0) return save(values);
    setCheck({ values, bound });
  };

  const confirm = async () => {
    if (!check) return;
    try {
      await save(check.values);
    } catch {
      // The page shows the save error; close so it is visible.
      setCheck(null);
    }
  };

  return { handleSubmit, isChecking, check, confirm, cancel: () => setCheck(null) };
}
