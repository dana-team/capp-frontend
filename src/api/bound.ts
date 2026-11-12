import { backendClient, clusterBase } from './client';
import { BoundCappsResponse, BoundResourceKind } from '@/types/bound';

const PLURAL: Record<BoundResourceKind, string> = { configmap: 'configmaps', secret: 'secrets' };

/** The Capps that reference a Secret or ConfigMap, and the ones that roll out when it changes. */
export function getBoundCapps(
  cluster: string,
  kind: BoundResourceKind,
  namespace: string,
  name: string,
): Promise<BoundCappsResponse> {
  return backendClient<BoundCappsResponse>(
    `${clusterBase(cluster)}/namespaces/${encodeURIComponent(namespace)}/${PLURAL[kind]}/${encodeURIComponent(name)}/bound`
  );
}
