import yaml from 'js-yaml';
import { CappRequest, CappResponse, LegacyCapp, LegacyCappSpec, ScaleMetric, CappState, CappSize, ResourceSpec, ResourceQuantities } from '@/types/capp';
import { CappFormValues, EventSourceFormEntry } from '@/components/capps/CappForm';

// ── Backend request builder ────────────────────────────────────────────────
// Used by CreateCappPage and EditCappPage to build the CappRequest sent to
// the capp-backend REST API.

export function buildCappRequest(namespace: string, values: CappFormValues): CappRequest {
  const req: CappRequest = {
    name: values.name,
    namespace,
    image: values.image,
  };

  const hasScaleSpec = values.scaleMetric || values.minReplicas !== undefined || values.maxReplicas !== undefined || values.scaleDelaySeconds !== undefined;
  if (hasScaleSpec) {
    req.scaleSpec = {
      ...(values.scaleMetric ? { metric: values.scaleMetric as ScaleMetric } : {}),
      ...(values.minReplicas !== undefined ? { minReplicas: values.minReplicas } : {}),
      ...(values.maxReplicas !== undefined ? { maxReplicas: values.maxReplicas } : {}),
      ...(values.scaleDelaySeconds !== undefined ? { scaleDelaySeconds: values.scaleDelaySeconds } : {}),
    };
  }

  if (values.state) req.state = values.state;
  if (values.containerName) req.containerName = values.containerName;

  if (values.sizingMode === 'custom') {
    const customResources = buildCustomResources(values.cpuRequest, values.cpuLimit, values.memoryRequest, values.memoryLimit);
    if (customResources) req.customResources = customResources;
  } else if (values.size) {
    req.size = values.size as CappSize;
  }

  if (values.envVars.length > 0) {
    req.env = values.envVars.map((ev) => {
      if (ev.source === 'secretKeyRef') {
        return { name: ev.name, valueFrom: { secretKeyRef: { name: ev.refName, key: ev.refKey } } };
      }
      if (ev.source === 'configMapKeyRef') {
        return { name: ev.name, valueFrom: { configMapKeyRef: { name: ev.refName, key: ev.refKey } } };
      }
      return { name: ev.name, value: ev.value ?? '' };
    });
  }

  const hasRoute = values.hostname || values.tlsEnabled !== undefined || values.routeTimeoutSeconds !== undefined;
  if (hasRoute) {
    req.routeSpec = {
      ...(values.hostname ? { hostname: values.hostname } : {}),
      ...(values.tlsEnabled !== undefined ? { tlsEnabled: values.tlsEnabled } : {}),
      ...(values.routeTimeoutSeconds !== undefined ? { routeTimeoutSeconds: Number(values.routeTimeoutSeconds) } : {}),
    };
  }

  if (values.logType && values.logHost && values.logUser && values.logPasswordSecret && values.logPasswordKey) {
    const logType = values.logType;
    const isDataStream = logType === 'elastic-datastream';
    if (isDataStream || values.logIndex) {
      req.logSpec = {
        type: logType,
        host: values.logHost,
        user: values.logUser,
        passwordSecret: values.logPasswordSecret,
        passwordKey: values.logPasswordKey,
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

  if (values.secretVolumes.length > 0) {
    req.secretVolumes = values.secretVolumes.map((v) => ({
      name: v.volumeName,
      secretName: v.secretName,
      mountPath: v.mountPath,
    }));
  }

  if (values.configMapVolumes.length > 0) {
    req.configMapVolumes = values.configMapVolumes.map((v) => ({
      name: v.volumeName,
      configMapName: v.configMapName,
      mountPath: v.mountPath,
    }));
  }

  if (values.volumeMounts.length > 0) {
    req.volumeMounts = values.volumeMounts.map((v) => ({
      name: v.volumeName,
      mountPath: v.mountPath,
    }));
  }

  if (values.eventSources && values.eventSources.length > 0) {
    req.eventSourcesSpec = {
      sources: values.eventSources.map((s: EventSourceFormEntry) => ({
        name: s.name,
        ...(s.uri ? { uri: s.uri } : {}),
        ...(s.sourceType === 'ping'
          ? {
              pingSourceConfiguration: {
                schedule: s.pingSchedule,
                ...(s.pingData ? { data: s.pingData } : {}),
              },
            }
          : {
              kafkaSourceConfiguration: {
                bootstrapServers: s.kafkaBootstrapServers.split(',').map((x) => x.trim()).filter(Boolean),
                topics: s.kafkaTopics.split(',').map((x) => x.trim()).filter(Boolean),
                secretRef: s.kafkaSecretRef,
                ...(s.kafkaConsumerGroup ? { consumerGroup: s.kafkaConsumerGroup } : {}),
                ...(s.kafkaConsumers !== undefined ? { consumers: s.kafkaConsumers } : {}),
              },
            }),
      })),
    };
  }

  return req;
}

function buildCustomResources(cpuReq: string, cpuLim: string, memReq: string, memLim: string): ResourceSpec | undefined {
  const requests: ResourceQuantities = {};
  const limits: ResourceQuantities = {};
  if (cpuReq) requests.cpu = cpuReq;
  if (memReq) requests.memory = memReq;
  if (cpuLim) limits.cpu = cpuLim;
  if (memLim) limits.memory = memLim;

  const hasRequests = Object.keys(requests).length > 0;
  const hasLimits = Object.keys(limits).length > 0;
  if (!hasRequests && !hasLimits) return undefined;

  return {
    ...(hasRequests ? { requests } : {}),
    ...(hasLimits ? { limits } : {}),
  };
}

// ── Form value converter for CappResponse (flat backend DTO) ──────────────

export function cappToFormValues(capp: CappResponse): CappFormValues {
  const parseCapacity = (storage: string): { value: string; unit: string } => {
    const match = storage.match(/^(\d+)(Mi|Gi|Ti)$/);
    if (match) return { value: match[1], unit: match[2] };
    return { value: storage, unit: 'Gi' };
  };

  const hasPresetSize = Boolean(capp.size);

  return {
    name: capp.name,
    scaleMetric: (capp.scaleSpec?.metric as ScaleMetric) ?? '',
    minReplicas: capp.scaleSpec?.minReplicas,
    maxReplicas: capp.scaleSpec?.maxReplicas,
    scaleDelaySeconds: capp.scaleSpec?.scaleDelaySeconds,
    state: capp.state ?? 'enabled',
    image: capp.image,
    containerName: capp.containerName ?? '',
    sizingMode: hasPresetSize ? 'preset' : (capp.resources ? 'custom' : 'preset'),
    size: (capp.size ?? '') as CappSize | '',
    cpuRequest: capp.resources?.requests?.cpu ?? '',
    cpuLimit: capp.resources?.limits?.cpu ?? '',
    memoryRequest: capp.resources?.requests?.memory ?? '',
    memoryLimit: capp.resources?.limits?.memory ?? '',
    envVars: (capp.env ?? []).map((e) => {
      if (e.valueFrom?.secretKeyRef) {
        return { name: e.name, source: 'secretKeyRef' as const, value: '', refName: e.valueFrom.secretKeyRef.name, refKey: e.valueFrom.secretKeyRef.key };
      }
      if (e.valueFrom?.configMapKeyRef) {
        return { name: e.name, source: 'configMapKeyRef' as const, value: '', refName: e.valueFrom.configMapKeyRef.name, refKey: e.valueFrom.configMapKeyRef.key };
      }
      return { name: e.name, source: 'literal' as const, value: e.value ?? '', refName: '', refKey: '' };
    }),
    hostname: capp.routeSpec?.hostname ?? '',
    tlsEnabled: capp.routeSpec?.tlsEnabled,
    routeTimeoutSeconds: capp.routeSpec?.routeTimeoutSeconds ?? undefined,
    logType: capp.logSpec?.type ?? '',
    logHost: capp.logSpec?.host ?? '',
    logIndex: capp.logSpec?.index ?? '',
    logUser: capp.logSpec?.user ?? '',
    logPasswordSecret: capp.logSpec?.passwordSecret ?? '',
    logPasswordKey: capp.logSpec?.passwordKey ?? '',
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
    secretVolumes: (capp.secretVolumes ?? []).map((v) => ({
      volumeName: v.name,
      secretName: v.secretName,
      mountPath: v.mountPath,
    })),
    configMapVolumes: (capp.configMapVolumes ?? []).map((v) => ({
      volumeName: v.name,
      configMapName: v.configMapName,
      mountPath: v.mountPath,
    })),
    // The backend echoes secret/configMap volume mounts back in volumeMounts too;
    // filter those out so only standalone mounts appear (avoids duplicate rows).
    volumeMounts: (() => {
      const ownedNames = new Set([
        ...(capp.secretVolumes ?? []).map((v) => v.name),
        ...(capp.configMapVolumes ?? []).map((v) => v.name),
      ]);
      return (capp.volumeMounts ?? [])
        .filter((v) => !ownedNames.has(v.name))
        .map((v) => ({ volumeName: v.name, mountPath: v.mountPath }));
    })(),
    eventSources: (capp.eventSourcesSpec?.sources ?? []).map((s): EventSourceFormEntry => {
      if (s.pingSourceConfiguration) {
        return {
          name: s.name,
          uri: s.uri ?? '',
          sourceType: 'ping',
          pingSchedule: s.pingSourceConfiguration.schedule,
          pingData: s.pingSourceConfiguration.data ?? '',
          kafkaBootstrapServers: '',
          kafkaTopics: '',
          kafkaConsumerGroup: '',
          kafkaConsumers: undefined,
          kafkaSecretRef: '',
        };
      }
      const k = s.kafkaSourceConfiguration;
      return {
        name: s.name,
        uri: s.uri ?? '',
        sourceType: 'kafka',
        pingSchedule: '',
        pingData: '',
        kafkaBootstrapServers: k?.bootstrapServers.join(', ') ?? '',
        kafkaTopics: k?.topics.join(', ') ?? '',
        kafkaConsumerGroup: k?.consumerGroup ?? '',
        kafkaConsumers: k?.consumers,
        kafkaSecretRef: k?.secretRef ?? '',
      };
    }),
  };
}

// ── Legacy K8s YAML builder (for the YAML preview tab only) ───────────────
// The output of this function is never sent to the backend; it is only used
// to populate the YAML editor tab so users can see the equivalent K8s YAML.

export function buildCappResource(namespace: string, values: CappFormValues): LegacyCapp {
  const containerResources = values.sizingMode === 'custom'
    ? buildCustomResources(values.cpuRequest, values.cpuLimit, values.memoryRequest, values.memoryLimit)
    : undefined;

  const spec: LegacyCappSpec = {
    configurationSpec: {
      template: {
        spec: {
          containers: [
            {
              ...(values.containerName ? { name: values.containerName } : {}),
              image: values.image,
              ...(values.envVars.length > 0
                ? { env: values.envVars.map((ev) => {
                  if (ev.source === 'secretKeyRef') {
                    return { name: ev.name, valueFrom: { secretKeyRef: { name: ev.refName, key: ev.refKey } } };
                  }
                  if (ev.source === 'configMapKeyRef') {
                    return { name: ev.name, valueFrom: { configMapKeyRef: { name: ev.refName, key: ev.refKey } } };
                  }
                  return { name: ev.name, value: ev.value ?? '' };
                }) }
                : {}),
              ...(values.volumeMounts.length > 0
                ? { volumeMounts: values.volumeMounts.map((v) => ({ name: v.volumeName, mountPath: v.mountPath })) }
                : {}),
              ...(containerResources ? { resources: containerResources } : {}),
            },
          ],
        },
      },
    },
  };

  const hasScaleSpec = values.scaleMetric || values.minReplicas !== undefined || values.maxReplicas !== undefined || values.scaleDelaySeconds !== undefined;
  if (hasScaleSpec) {
    spec.scaleSpec = {
      ...(values.scaleMetric ? { metric: values.scaleMetric as ScaleMetric } : {}),
      ...(values.minReplicas !== undefined ? { minReplicas: values.minReplicas } : {}),
      ...(values.maxReplicas !== undefined ? { maxReplicas: values.maxReplicas } : {}),
      ...(values.scaleDelaySeconds !== undefined ? { scaleDelaySeconds: values.scaleDelaySeconds } : {}),
    };
  }

  if (values.state) spec.state = values.state as CappState;
  if (values.sizingMode === 'preset' && values.size) spec.size = values.size as CappSize;

  const hasRoute = values.hostname || values.tlsEnabled !== undefined || values.routeTimeoutSeconds !== undefined;
  if (hasRoute) {
    spec.routeSpec = {
      ...(values.hostname ? { hostname: values.hostname } : {}),
      ...(values.tlsEnabled !== undefined ? { tlsEnabled: values.tlsEnabled } : {}),
      ...(values.routeTimeoutSeconds !== undefined ? { routeTimeoutSeconds: Number(values.routeTimeoutSeconds) } : {}),
    };
  }

  if (values.logType && values.logHost && values.logUser && values.logPasswordSecret && values.logPasswordKey) {
    const logType = values.logType;
    const isDataStream = logType === 'elastic-datastream';
    if (isDataStream || values.logIndex) {
      spec.logSpec = {
        type: logType,
        host: values.logHost,
        user: values.logUser,
        passwordSecret: values.logPasswordSecret,
        passwordKey: values.logPasswordKey,
        ...(!isDataStream && values.logIndex ? { index: values.logIndex } : {}),
      };
    }
  }

  const hasVolumes = values.nfsVolumes.length > 0 || values.secretVolumes.length > 0 || values.configMapVolumes.length > 0;
  if (hasVolumes) {
    spec.volumesSpec = {
      ...(values.nfsVolumes.length > 0 ? {
        nfsVolumes: values.nfsVolumes.map((v) => ({
          name: v.name,
          server: v.server,
          path: v.path,
          capacity: { storage: `${v.capacityValue}${v.capacityUnit}` },
        })),
      } : {}),
      ...(values.secretVolumes.length > 0 ? {
        secretVolumes: values.secretVolumes.map((v) => ({
          name: v.volumeName,
          secretName: v.secretName,
          mountPath: v.mountPath,
        })),
      } : {}),
      ...(values.configMapVolumes.length > 0 ? {
        configMapVolumes: values.configMapVolumes.map((v) => ({
          name: v.volumeName,
          configMapName: v.configMapName,
          mountPath: v.mountPath,
        })),
      } : {}),
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
    maxReplicas: capp.spec.scaleSpec?.maxReplicas,
    scaleDelaySeconds: capp.spec.scaleSpec?.scaleDelaySeconds,
    state: capp.spec.state ?? 'enabled',
    image: container.image,
    containerName: container.name ?? '',
    sizingMode: capp.spec.size ? 'preset' : (container.resources ? 'custom' : 'preset'),
    size: (capp.spec.size ?? '') as CappSize | '',
    cpuRequest: container.resources?.requests?.cpu ?? '',
    cpuLimit: container.resources?.limits?.cpu ?? '',
    memoryRequest: container.resources?.requests?.memory ?? '',
    memoryLimit: container.resources?.limits?.memory ?? '',
    envVars: (container.env ?? []).map((e) => {
      if (e.valueFrom?.secretKeyRef) {
        return { name: e.name, source: 'secretKeyRef' as const, value: '', refName: e.valueFrom.secretKeyRef.name, refKey: e.valueFrom.secretKeyRef.key };
      }
      if (e.valueFrom?.configMapKeyRef) {
        return { name: e.name, source: 'configMapKeyRef' as const, value: '', refName: e.valueFrom.configMapKeyRef.name, refKey: e.valueFrom.configMapKeyRef.key };
      }
      return { name: e.name, source: 'literal' as const, value: e.value ?? '', refName: '', refKey: '' };
    }),
    hostname: capp.spec.routeSpec?.hostname ?? '',
    tlsEnabled: capp.spec.routeSpec?.tlsEnabled,
    routeTimeoutSeconds: capp.spec.routeSpec?.routeTimeoutSeconds,
    logType: capp.spec.logSpec?.type ?? '',
    logHost: capp.spec.logSpec?.host ?? '',
    logIndex: capp.spec.logSpec?.index ?? '',
    logUser: capp.spec.logSpec?.user ?? '',
    logPasswordSecret: capp.spec.logSpec?.passwordSecret ?? '',
    logPasswordKey: capp.spec.logSpec?.passwordKey ?? '',
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
    secretVolumes: (capp.spec.volumesSpec?.secretVolumes ?? []).map((v) => ({
      volumeName: v.name,
      secretName: v.secretName,
      mountPath: v.mountPath,
    })),
    configMapVolumes: (capp.spec.volumesSpec?.configMapVolumes ?? []).map((v) => ({
      volumeName: v.name,
      configMapName: v.configMapName,
      mountPath: v.mountPath,
    })),
    volumeMounts: (container.volumeMounts ?? []).map((v) => ({
      volumeName: v.name,
      mountPath: v.mountPath,
    })),
    eventSources: [],
  };
}
