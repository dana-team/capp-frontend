import yaml from 'js-yaml';
import { CappRequest, CappResponse, LegacyCapp, LegacyCappSpec, ScaleMetric, CappState } from '@/types/capp';
import { CappFormValues } from '@/components/capps/CappForm';

// ── Backend request builder ────────────────────────────────────────────────
// Used by CreateCappPage and EditCappPage to build the CappRequest sent to
// the capp-backend REST API.

export function buildCappRequest(namespace: string, values: CappFormValues): CappRequest {
  const req: CappRequest = {
    name: values.name,
    namespace,
    image: values.image,
  };

  const hasScaleSpec = values.scaleMetric || values.minReplicas !== undefined || values.scaleDelaySeconds !== undefined;
  if (hasScaleSpec) {
    req.scaleSpec = {
      ...(values.scaleMetric ? { metric: values.scaleMetric as ScaleMetric } : {}),
      ...(values.minReplicas !== undefined ? { minReplicas: values.minReplicas } : {}),
      ...(values.scaleDelaySeconds !== undefined ? { scaleDelaySeconds: values.scaleDelaySeconds } : {}),
    };
  }

  if (values.state) req.state = values.state;
  if (values.containerName) req.containerName = values.containerName;

  if (values.envVars.length > 0) {
    req.env = values.envVars.map((ev) => ({ name: ev.key, value: ev.value }));
  }

  const hasRoute = values.hostname || values.tlsEnabled !== undefined || values.routeTimeoutSeconds !== undefined;
  if (hasRoute) {
    req.routeSpec = {
      ...(values.hostname ? { hostname: values.hostname } : {}),
      ...(values.tlsEnabled !== undefined ? { tlsEnabled: values.tlsEnabled } : {}),
      ...(values.routeTimeoutSeconds !== undefined ? { routeTimeoutSeconds: Number(values.routeTimeoutSeconds) } : {}),
    };
  }

  if (values.logType && values.logHost && values.logUser && values.logPasswordSecret) {
    const logType = values.logType;
    const isDataStream = logType === 'elastic-datastream';
    if (isDataStream || values.logIndex) {
      req.logSpec = {
        type: logType,
        host: values.logHost,
        user: values.logUser,
        passwordSecret: values.logPasswordSecret,
        ...(!isDataStream && values.logIndex ? { index: values.logIndex } : {}),
      };
    }
  }

  if (values.nfsVolumes.length > 0) {
    req.nfsVolumes = values.nfsVolumes.map((v) => ({
      name: v.name,
      server: v.server,
      path: v.path,
      capacity: `${v.capacityValue}${v.capacityUnit}`,
    }));
  }

  return req;
}

// ── Form value converter for CappResponse (flat backend DTO) ──────────────

export function cappToFormValues(capp: CappResponse): CappFormValues {
  const parseCapacity = (storage: string): { value: string; unit: string } => {
    const match = storage.match(/^(\d+)(Mi|Gi|Ti)$/);
    if (match) return { value: match[1], unit: match[2] };
    return { value: storage, unit: 'Gi' };
  };

  return {
    name: capp.name,
    scaleMetric: (capp.scaleSpec?.metric as ScaleMetric) ?? '',
    minReplicas: capp.scaleSpec?.minReplicas,
    scaleDelaySeconds: capp.scaleSpec?.scaleDelaySeconds,
    state: capp.state ?? 'enabled',
    image: capp.image,
    containerName: capp.containerName ?? '',
    envVars: (capp.env ?? []).map((e) => ({ key: e.name, value: e.value })),
    hostname: capp.routeSpec?.hostname ?? '',
    tlsEnabled: capp.routeSpec?.tlsEnabled,
    routeTimeoutSeconds: capp.routeSpec?.routeTimeoutSeconds ?? undefined,
    logType: capp.logSpec?.type ?? '',
    logHost: capp.logSpec?.host ?? '',
    logIndex: capp.logSpec?.index ?? '',
    logUser: capp.logSpec?.user ?? '',
    logPasswordSecret: capp.logSpec?.passwordSecret ?? '',
    nfsVolumes: (capp.nfsVolumes ?? []).map((v) => {
      const { value, unit } = parseCapacity(v.capacity);
      return {
        name: v.name,
        server: v.server,
        path: v.path,
        capacityValue: value,
        capacityUnit: unit as 'Mi' | 'Gi' | 'Ti',
      };
    }),
  };
}

// ── Legacy K8s YAML builder (for the YAML preview tab only) ───────────────
// The output of this function is never sent to the backend; it is only used
// to populate the YAML editor tab so users can see the equivalent K8s YAML.

export function buildCappResource(namespace: string, values: CappFormValues): LegacyCapp {
  const spec: LegacyCappSpec = {
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

  const hasScaleSpec = values.scaleMetric || values.minReplicas !== undefined || values.scaleDelaySeconds !== undefined;
  if (hasScaleSpec) {
    spec.scaleSpec = {
      ...(values.scaleMetric ? { metric: values.scaleMetric as ScaleMetric } : {}),
      ...(values.minReplicas !== undefined ? { minReplicas: values.minReplicas } : {}),
      ...(values.scaleDelaySeconds !== undefined ? { scaleDelaySeconds: values.scaleDelaySeconds } : {}),
    };
  }

  if (values.state) spec.state = values.state as CappState;

  const hasRoute = values.hostname || values.tlsEnabled !== undefined || values.routeTimeoutSeconds !== undefined;
  if (hasRoute) {
    spec.routeSpec = {
      ...(values.hostname ? { hostname: values.hostname } : {}),
      ...(values.tlsEnabled !== undefined ? { tlsEnabled: values.tlsEnabled } : {}),
      ...(values.routeTimeoutSeconds !== undefined ? { routeTimeoutSeconds: Number(values.routeTimeoutSeconds) } : {}),
    };
  }

  if (values.logType && values.logHost && values.logUser && values.logPasswordSecret) {
    const logType = values.logType;
    const isDataStream = logType === 'elastic-datastream';
    if (isDataStream || values.logIndex) {
      spec.logSpec = {
        type: logType,
        host: values.logHost,
        user: values.logUser,
        passwordSecret: values.logPasswordSecret,
        ...(!isDataStream && values.logIndex ? { index: values.logIndex } : {}),
      };
    }
  }

  if (values.nfsVolumes.length > 0) {
    spec.volumesSpec = {
      nfsVolumes: values.nfsVolumes.map((v) => ({
        name: v.name,
        server: v.server,
        path: v.path,
        capacity: { storage: `${v.capacityValue}${v.capacityUnit}` },
      })),
    };
  }

  return {
    apiVersion: 'rcs.dana.io/v1alpha1',
    kind: 'Capp',
    metadata: { name: values.name, namespace },
    spec,
  };
}

export function cappToYaml(capp: LegacyCapp): string {
  return yaml.dump(capp, { indent: 2 });
}

export function yamlToCappFormValues(yamlStr: string): CappFormValues {
  const capp = yaml.load(yamlStr) as LegacyCapp;
  const container = capp.spec.configurationSpec.template.spec.containers[0] ?? { image: '' };
  return {
    name: capp.metadata.name,
    scaleMetric: (capp.spec.scaleSpec?.metric as ScaleMetric) ?? '',
    minReplicas: capp.spec.scaleSpec?.minReplicas,
    scaleDelaySeconds: capp.spec.scaleSpec?.scaleDelaySeconds,
    state: capp.spec.state ?? 'enabled',
    image: container.image,
    containerName: container.name ?? '',
    envVars: (container.env ?? []).map((e) => ({ key: e.name, value: e.value })),
    hostname: capp.spec.routeSpec?.hostname ?? '',
    tlsEnabled: capp.spec.routeSpec?.tlsEnabled,
    routeTimeoutSeconds: capp.spec.routeSpec?.routeTimeoutSeconds,
    logType: capp.spec.logSpec?.type ?? '',
    logHost: capp.spec.logSpec?.host ?? '',
    logIndex: capp.spec.logSpec?.index ?? '',
    logUser: capp.spec.logSpec?.user ?? '',
    logPasswordSecret: capp.spec.logSpec?.passwordSecret ?? '',
    nfsVolumes: (capp.spec.volumesSpec?.nfsVolumes ?? []).map((v) => {
      const match = v.capacity.storage.match(/^(\d+)(Mi|Gi|Ti)$/);
      return {
        name: v.name,
        server: v.server,
        path: v.path,
        capacityValue: match ? match[1] : '1',
        capacityUnit: (match ? match[2] : 'Gi') as 'Mi' | 'Gi' | 'Ti',
      };
    }),
  };
}
