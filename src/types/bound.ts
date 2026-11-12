/** A Secret or ConfigMap that Capps can reference. */
export type BoundResourceKind = 'configmap' | 'secret';

/** GET .../{configmaps|secrets}/:name/bound */
export interface BoundCappsResponse {
  /** Every Capp in the namespace that references the resource. Deletion is refused while non-empty. */
  boundCapps: string[];
  /** Subset of boundCapps that roll out when the resource's data changes. */
  toReload: string[];
}

export const BOUND_KIND_LABEL: Record<BoundResourceKind, string> = {
  configmap: 'ConfigMap',
  secret: 'Secret',
};
