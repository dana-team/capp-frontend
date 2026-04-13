export interface SecretRequest {
  name: string;
  namespace: string;
  type?: string;
  data: Record<string, string>;
}

export interface SecretResponse {
  name: string;
  namespace: string;
  type?: string;
  data: Record<string, string>;
  createdAt?: string;
  uid?: string;
  resourceVersion?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface SecretListResponse {
  items: SecretResponse[];
  total: number;
}

export interface SecretUpdateRequest {
  data: Record<string, string>;
}
