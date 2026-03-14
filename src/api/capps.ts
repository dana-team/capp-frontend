import { k8sClient } from './client';
import { Capp } from '@/types/capp';
import { K8sList } from '@/types/kubernetes';

const API_GROUP = 'rcs.dana.io';
const API_VERSION = 'v1alpha1';
const RESOURCE = 'capps';

export function listCapps(namespace?: string): Promise<K8sList<Capp>> {
  const path = namespace
    ? `/apis/${API_GROUP}/${API_VERSION}/namespaces/${namespace}/${RESOURCE}`
    : `/apis/${API_GROUP}/${API_VERSION}/${RESOURCE}`;

  return k8sClient<K8sList<Capp>>(path);
}

export function getCapp(namespace: string, name: string): Promise<Capp> {
  return k8sClient<Capp>(
    `/apis/${API_GROUP}/${API_VERSION}/namespaces/${namespace}/${RESOURCE}/${name}`
  );
}

export function createCapp(namespace: string, capp: Partial<Capp>): Promise<Capp> {
  return k8sClient<Capp>(
    `/apis/${API_GROUP}/${API_VERSION}/namespaces/${namespace}/${RESOURCE}`,
    {
      method: 'POST',
      body: JSON.stringify(capp),
    }
  );
}

export function updateCapp(namespace: string, name: string, capp: Capp): Promise<Capp> {
  return k8sClient<Capp>(
    `/apis/${API_GROUP}/${API_VERSION}/namespaces/${namespace}/${RESOURCE}/${name}`,
    {
      method: 'PUT',
      body: JSON.stringify(capp),
    }
  );
}

export function deleteCapp(namespace: string, name: string): Promise<void> {
  return k8sClient<void>(
    `/apis/${API_GROUP}/${API_VERSION}/namespaces/${namespace}/${RESOURCE}/${name}`,
    {
      method: 'DELETE',
    }
  );
}
