import yaml from 'js-yaml';
import { Capp, CappSpec } from '@/types/capp';
import { CappFormValues } from '@/components/capps/CappForm';

export function buildCappResource(namespace: string, values: CappFormValues): Capp {
  const spec: CappSpec = {
    configurationSpec: {
      template: {
        spec: {
          containers: [
            {
              ...(values.containerName ? { name: values.containerName } : {}),
              image: values.image,
              ...(values.envVars.length > 0
                ? { env: values.envVars.map((ev) => ({ name: ev.key, value: ev.value })) }
                : {}),
            },
          ],
        },
      },
    },
  };

  if (values.scaleMetric) {
    spec.scaleMetric = values.scaleMetric;
  }

  if (values.state) {
    spec.state = values.state;
  }

  // Route spec
  const hasRoute =
    values.hostname || values.tlsEnabled !== undefined || values.routeTimeoutSeconds;
  if (hasRoute) {
    spec.routeSpec = {
      ...(values.hostname ? { hostname: values.hostname } : {}),
      ...(values.tlsEnabled !== undefined ? { tlsEnabled: values.tlsEnabled } : {}),
      ...(values.routeTimeoutSeconds
        ? { routeTimeoutSeconds: Number(values.routeTimeoutSeconds) }
        : {}),
    };
  }

  // Log spec
  const hasLog =
    values.logHost || values.logIndex || values.logUser || values.logPasswordSecret;
  if (hasLog && values.logHost && values.logIndex && values.logUser && values.logPasswordSecret) {
    spec.logSpec = {
      type: 'elastic',
      host: values.logHost,
      index: values.logIndex,
      user: values.logUser,
      passwordSecret: values.logPasswordSecret,
    };
  }

  // Volumes spec
  if (values.nfsVolumes.length > 0) {
    spec.volumesSpec = {
      nfsVolumes: values.nfsVolumes.map((v) => ({
        name: v.name,
        server: v.server,
        path: v.path,
        capacity: {
          storage: `${v.capacityValue}${v.capacityUnit}`,
        },
      })),
    };
  }

  // Sources
  if (values.kafkaSources.length > 0) {
    spec.sources = values.kafkaSources.map((s) => ({
      name: s.name,
      type: 'kafka' as const,
      bootstrapServers: s.bootstrapServers,
      topic: s.topics,
    }));
  }

  return {
    apiVersion: 'rcs.dana.io/v1alpha1',
    kind: 'Capp',
    metadata: {
      name: values.name,
      namespace,
    },
    spec,
  };
}

export function cappToFormValues(capp: Capp): CappFormValues {
  const container = capp.spec.configurationSpec.template.spec.containers[0] ?? {
    image: '',
  };

  const parseCapacity = (storage: string): { value: string; unit: string } => {
    const match = storage.match(/^(\d+)(Mi|Gi|Ti)$/);
    if (match) return { value: match[1], unit: match[2] };
    return { value: storage, unit: 'Gi' };
  };

  return {
    name: capp.metadata.name,
    scaleMetric: capp.spec.scaleMetric ?? '',
    state: capp.spec.state ?? 'enabled',
    image: container.image,
    containerName: container.name ?? '',
    envVars: (container.env ?? []).map((e) => ({ key: e.name, value: e.value })),
    hostname: capp.spec.routeSpec?.hostname ?? '',
    tlsEnabled: capp.spec.routeSpec?.tlsEnabled,
    routeTimeoutSeconds: capp.spec.routeSpec?.routeTimeoutSeconds ?? undefined,
    logHost: capp.spec.logSpec?.host ?? '',
    logIndex: capp.spec.logSpec?.index ?? '',
    logUser: capp.spec.logSpec?.user ?? '',
    logPasswordSecret: capp.spec.logSpec?.passwordSecret ?? '',
    nfsVolumes: (capp.spec.volumesSpec?.nfsVolumes ?? []).map((v) => {
      const { value, unit } = parseCapacity(v.capacity.storage);
      return {
        name: v.name,
        server: v.server,
        path: v.path,
        capacityValue: value,
        capacityUnit: unit as 'Mi' | 'Gi' | 'Ti',
      };
    }),
    kafkaSources: (capp.spec.sources ?? []).map((s) => ({
      name: s.name,
      bootstrapServers: s.bootstrapServers,
      topics: s.topic,
    })),
  };
}

export function cappToYaml(capp: Capp): string {
  return yaml.dump(capp, { indent: 2 });
}

export function yamlToCappFormValues(yamlStr: string): CappFormValues {
  const capp = yaml.load(yamlStr) as Capp;
  return cappToFormValues(capp);
}
