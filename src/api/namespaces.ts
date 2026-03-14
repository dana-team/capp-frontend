import { k8sClient } from './client';
import { K8sList, K8sNamespace } from '@/types/kubernetes';

export function listNamespaces(): Promise<K8sList<K8sNamespace>> {
  return k8sClient<K8sList<K8sNamespace>>('/api/v1/namespaces');
}
