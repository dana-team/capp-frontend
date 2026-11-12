import { BareCappResponse } from '@/types/capp';
import { BoundResourceKind } from '@/types/bound';

export interface BoundRef {
  kind: BoundResourceKind;
  name: string;
  /** Where the Capp uses it, e.g. "env", "volume". */
  via: string[];
  /**
   * Used by the Capp's pods. Only these references roll the Capp out on change:
   * the operator reads log and Kafka Secrets itself, so a rollout would not refresh them.
   */
  inPods: boolean;
}

/**
 * The Secrets and ConfigMaps a Capp references, mirroring how the backend decides
 * which Capps are bound to a resource.
 */
export function cappBoundResources(capp: BareCappResponse): BoundRef[] {
  const refs = new Map<string, BoundRef>();
  const add = (kind: BoundResourceKind, name: string | undefined, via: string, inPods: boolean) => {
    if (!name) return;
    const key = `${kind}/${name}`;
    const ref = refs.get(key) ?? { kind, name, via: [], inPods: false };
    if (!ref.via.includes(via)) ref.via.push(via);
    ref.inPods ||= inPods;
    refs.set(key, ref);
  };

  capp.env?.forEach((e) => {
    add('secret', e.valueFrom?.secretKeyRef?.name, 'env', true);
    add('configmap', e.valueFrom?.configMapKeyRef?.name, 'env', true);
  });
  capp.secretVolumes?.forEach((v) => add('secret', v.secretName, 'volume', true));
  capp.configMapVolumes?.forEach((v) => add('configmap', v.configMapName, 'volume', true));
  capp.imagePullSecrets?.forEach((s) => add('secret', s, 'image pull', true));
  add('secret', capp.logSpec?.passwordSecret, 'log', false);
  capp.eventSourcesSpec?.sources?.forEach((s) =>
    add('secret', s.kafkaSourceConfiguration?.secretRef, 'Kafka source', false),
  );

  return [...refs.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}
