export interface K8sMetadata {
  name: string;
  namespace?: string;
  creationTimestamp?: string;
  resourceVersion?: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  generation?: number;
}

export interface K8sResource<TSpec = unknown, TStatus = unknown> {
  apiVersion: string;
  kind: string;
  metadata: K8sMetadata;
  spec: TSpec;
  status?: TStatus;
}

export interface K8sList<T> {
  apiVersion: string;
  kind: string;
  metadata: { resourceVersion: string };
  items: T[];
}

export interface K8sCondition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface K8sNamespace {
  metadata: K8sMetadata;
  status: { phase: string };
}
