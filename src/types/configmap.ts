export interface ConfigMapRequest {
  name: string;
  namespace: string;
  data: Record<string, string>;
}

export interface ConfigMapResponse {
  name: string;
  namespace: string;
  data: Record<string, string>;
  createdAt?: string;
  uid?: string;
  resourceVersion?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface ConfigMapListResponse {
  items: ConfigMapResponse[];
  total: number;
}

export interface ConfigMapUpdateRequest {
  data: Record<string, string>;
}