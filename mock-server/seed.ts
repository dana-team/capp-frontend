/**
 * Seed data for the mock store, generated with @faker-js/faker.
 * Usage: `const seed = seedStore(store)`; reproducible via MOCK_SEED or the `seed` argument.
 */
import { faker } from '@faker-js/faker';
import type {
  CappResponse,
  CappSize,
  ClusterMeta,
  ConditionResponse,
  EnvVar,
  EventingStatusResponse,
  LogSpec,
  NFSVolume,
  ResourceSpec,
  RouteSpec,
  ScaleSpec,
  SourceConfig,
} from '../src/types/capp';
import type { ConfigMapResponse } from '../src/types/configmap';
import type { SecretResponse } from '../src/types/secret';
import type { NamespaceItem } from '../src/api/namespaces';
import { ANNOTATION_MESSAGE, LABEL_BACKUP_TO_GIT } from '../src/types/capp';
import { buildDockerConfigJson, DOCKER_CONFIG_JSON_KEY, DOCKER_CONFIG_JSON_TYPE } from '../src/utils/dockerConfig';
import { SIZES, type MockStore } from './store';

const dns = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');

function uniqueName(used: Set<string>, make: () => string): string {
  let n = dns(make());
  for (let i = 2; used.has(n); i++) n = `${n.replace(/-\d+$/, '')}-${i}`;
  used.add(n);
  return n;
}

const iso = (now: number, minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
const semver = () => `${faker.number.int({ min: 0, max: 3 })}.${faker.number.int({ min: 0, max: 20 })}.${faker.number.int({ min: 0, max: 9 })}`;

function genClusters(): ClusterMeta[] {
  // 3 clusters: two healthy (so migration has a target) + one unhealthy
  const count = 3;
  const names = ['prod-east', 'prod-west', 'staging', 'dev', 'dr-site'];
  const picked = faker.helpers.shuffle(names).slice(0, count);
  return picked.map((name, i): ClusterMeta => {
    return {
      name,
      displayName: `${faker.location.city()} (${name})`,
      healthy: !(i === count - 1), // last one is unhealthy
      ...(i === 1 ? { isOpenShift: true } : {}),
      ...(i === 0 ? { gitOpsPath: name } : {}),
    };
  });
}

function genSecret(ns: string, name: string, rv: string, now: number): SecretResponse {
  return {
    name,
    namespace: ns,
    type: 'Opaque',
    data: {
      username: faker.internet.username(),
      password: faker.internet.password({ length: 20 }),
      ...(faker.datatype.boolean() ? { 'api-key': faker.string.alphanumeric(32) } : {}),
    },
    createdAt: iso(now, faker.number.int({ min: 60, max: 60 * 24 * 90 })),
    uid: faker.string.uuid(),
    resourceVersion: rv,
  };
}

const REGISTRIES = ['ghcr.io', 'docker.io', 'quay.io', 'registry.internal.example.com:5000'];

function genPullSecret(ns: string, names: Set<string>, rv: string, now: number): SecretResponse {
  const server = faker.helpers.arrayElement(REGISTRIES);
  const name = uniqueName(names, () => `${server.split(/[.:]/)[0]}-pull-secret`);
  const username = faker.internet.username().toLowerCase();
  return {
    name,
    namespace: ns,
    type: DOCKER_CONFIG_JSON_TYPE,
    data: {
      [DOCKER_CONFIG_JSON_KEY]: buildDockerConfigJson({
        server,
        username,
        password: faker.string.alphanumeric(36),
        ...(faker.datatype.boolean() ? { email: faker.internet.email().toLowerCase() } : {}),
      }),
    },
    createdAt: iso(now, faker.number.int({ min: 60, max: 60 * 24 * 90 })),
    uid: faker.string.uuid(),
    resourceVersion: rv,
  };
}

function genConfigMap(ns: string, name: string, rv: string, now: number): ConfigMapResponse {
  return {
    name,
    namespace: ns,
    data: {
      LOG_LEVEL: faker.helpers.arrayElement(['debug', 'info', 'warn']),
      API_URL: faker.internet.url({ appendSlash: false }),
      'app.properties': `feature.${faker.word.noun()}=${faker.datatype.boolean()}\ntimeout=${faker.number.int({ min: 5, max: 60 })}`,
    },
    createdAt: iso(now, faker.number.int({ min: 60, max: 60 * 24 * 90 })),
    uid: faker.string.uuid(),
    resourceVersion: rv,
  };
}

function genConditions(now: number): ConditionResponse[] {
  const roll = faker.number.float();
  const t = iso(now, faker.number.int({ min: 1, max: 60 * 48 }));
  if (roll < 0.7) {
    return [
      { source: 'capp', type: 'Ready', status: 'True', reason: 'Reconciled', message: 'Capp is ready', lastTransitionTime: t },
      { source: 'knative', type: 'ConfigurationsReady', status: 'True', lastTransitionTime: t },
      { source: 'knative', type: 'RoutesReady', status: 'True', lastTransitionTime: t },
    ];
  }
  if (roll < 0.85) {
    const [reason, message] = faker.helpers.arrayElement([
      ['RevisionFailed', 'Revision failed: container exited with code 1'],
      ['ImagePullBackOff', 'Back-off pulling image'],
      ['QuotaExceeded', 'exceeded quota: compute-resources'],
    ]);
    return [
      { source: 'capp', type: 'Ready', status: 'False', reason, message, lastTransitionTime: t },
      { source: 'knative', type: 'ConfigurationsReady', status: 'False', reason, message, lastTransitionTime: t },
    ];
  }
  return [
    { source: 'capp', type: 'Ready', status: 'Unknown', reason: 'Progressing', message: 'Waiting for revision to become ready', lastTransitionTime: t },
  ];
}

interface NsObjects {
  secrets: SecretResponse[];
  configMaps: ConfigMapResponse[];
  pullSecrets: SecretResponse[];
}

function genCapp(
  name: string,
  ns: string,
  cluster: string,
  objs: NsObjects,
  rv: string,
  now: number,
  usedVolNames: Set<string>,
): CappResponse {
  const org = faker.helpers.arrayElement(['dana-team', 'acme', 'platform', 'payments']);
  const image = `ghcr.io/${org}/${dns(faker.word.noun())}:${semver()}`;
  const created = iso(now, faker.number.int({ min: 30, max: 60 * 24 * 60 }));
  const state = faker.helpers.weightedArrayElement([
    { value: 'enabled' as const, weight: 8 },
    { value: 'disabled' as const, weight: 2 },
  ]);

  const useSize = faker.datatype.boolean();
  const size: CappSize | undefined = useSize ? faker.helpers.arrayElement(['small', 'medium', 'large'] as const) : undefined;
  const resources: ResourceSpec = size
    ? SIZES[size]
    : {
        requests: { cpu: `${faker.helpers.arrayElement([50, 100, 200])}m`, memory: `${faker.helpers.arrayElement([64, 128, 256])}Mi` },
        limits: { cpu: `${faker.helpers.arrayElement([300, 500, 1000])}m`, memory: `${faker.helpers.arrayElement([512, 1024, 2048])}Mi` },
      };

  const minReplicas = faker.number.int({ min: 0, max: 2 });
  const scaleSpec: ScaleSpec = {
    metric: faker.helpers.arrayElement(['concurrency', 'cpu', 'memory', 'rps'] as const),
    minReplicas,
    maxReplicas: minReplicas + faker.number.int({ min: 1, max: 8 }),
    ...(faker.datatype.boolean() ? { scaleDelaySeconds: faker.helpers.arrayElement([30, 60, 120]) } : {}),
  };

  const env: EnvVar[] = [
    { name: 'APP_ENV', value: faker.helpers.arrayElement(['production', 'staging', 'development']) },
    { name: 'PORT', value: '8080' },
  ];
  if (objs.secrets.length && faker.datatype.boolean({ probability: 0.7 })) {
    const s = faker.helpers.arrayElement(objs.secrets);
    env.push({ name: 'DB_PASSWORD', valueFrom: { secretKeyRef: { name: s.name, key: 'password' } } });
  }
  if (objs.configMaps.length && faker.datatype.boolean({ probability: 0.7 })) {
    const m = faker.helpers.arrayElement(objs.configMaps);
    env.push({ name: 'LOG_LEVEL', valueFrom: { configMapKeyRef: { name: m.name, key: 'LOG_LEVEL' } } });
  }

  const capp: CappResponse = {
    name,
    namespace: ns,
    createdAt: created,
    uid: faker.string.uuid(),
    resourceVersion: rv,
    scaleSpec,
    state,
    image,
    containerName: name,
    ...(size ? { size } : {}),
    resources,
    env,
    status: {
      conditions: genConditions(now),
      stateStatus: { state, lastChange: iso(now, faker.number.int({ min: 1, max: 60 * 24 * 10 })) },
    },
  };

  if (faker.datatype.boolean({ probability: 0.25 })) capp.labels = { [LABEL_BACKUP_TO_GIT]: 'true' };
  if (faker.datatype.boolean({ probability: 0.2 })) {
    capp.annotations = { 'rcs.dana.io/owner': faker.internet.email().toLowerCase() };
  }
  if (faker.datatype.boolean({ probability: 0.2 })) {
    capp.annotations = {
      ...capp.annotations,
      [ANNOTATION_MESSAGE]: faker.helpers.arrayElement([
        'Scheduled maintenance on Sunday 02:00–04:00 UTC. Expect brief downtime.',
        'This Capp is deprecated and will be removed at the end of the quarter. Migrate to the v2 service.',
        'Owned by the platform team. Contact #platform-support before changing scaling settings.',
        'Image is pinned to a known-good version while an upstream regression is investigated.',
      ]),
    };
  }

  if (faker.datatype.boolean({ probability: 0.6 })) {
    const route: RouteSpec = {
      hostname: `${name}.${ns}.apps.${cluster}.example.com`,
      tlsEnabled: faker.datatype.boolean(),
      routeTimeoutSeconds: faker.datatype.boolean() ? faker.helpers.arrayElement([30, 60, 300]) : null,
    };
    capp.routeSpec = route;
  }

  if (objs.secrets.length && faker.datatype.boolean({ probability: 0.3 })) {
    const s = faker.helpers.arrayElement(objs.secrets);
    const log: LogSpec = {
      type: faker.helpers.arrayElement(['elastic', 'elastic-datastream'] as const),
      host: `elastic.${cluster}.example.com`,
      target: `logs-${ns}`,
      user: faker.internet.username().toLowerCase().replace(/[^a-z0-9]/g, ''),
      passwordSecret: s.name,
      passwordKey: 'password',
    };
    capp.logSpec = log;
  }

  // NFS volumes must be mounted (operator webhook rejects unmounted NFS volumes)
  if (faker.datatype.boolean({ probability: 0.3 })) {
    const nfsVolumes: NFSVolume[] = [];
    capp.volumeMounts = [];
    for (let i = 0; i < faker.number.int({ min: 1, max: 2 }); i++) {
      const vname = uniqueName(usedVolNames, () => `nfs-${faker.word.noun()}`);
      nfsVolumes.push({
        name: vname,
        server: faker.internet.ipv4(),
        path: `/exports/${dns(faker.word.noun())}`,
        capacity: `${faker.helpers.arrayElement([5, 10, 50, 100])}Gi`,
      });
      capp.volumeMounts.push({ name: vname, mountPath: `/mnt/${vname}` });
    }
    capp.nfsVolumes = nfsVolumes;
  }
  if (objs.secrets.length && faker.datatype.boolean({ probability: 0.25 })) {
    const s = faker.helpers.arrayElement(objs.secrets);
    capp.secretVolumes = [{ name: `secret-${s.name}`.slice(0, 50), secretName: s.name, mountPath: `/etc/secrets/${s.name}` }];
  }
  if (objs.configMaps.length && faker.datatype.boolean({ probability: 0.25 })) {
    const m = faker.helpers.arrayElement(objs.configMaps);
    capp.configMapVolumes = [{ name: `config-${m.name}`.slice(0, 50), configMapName: m.name, mountPath: `/etc/config/${m.name}` }];
  }

  if (faker.datatype.boolean({ probability: 0.3 })) {
    const sources: SourceConfig[] = [];
    const eventing: EventingStatusResponse = { eventSources: [] };
    if (faker.datatype.boolean()) {
      sources.push({
        name: 'heartbeat',
        pingSourceConfiguration: { schedule: faker.helpers.arrayElement(['*/5 * * * *', '0 * * * *', '0 3 * * *']), data: '{"ping":true}' },
      });
      eventing.eventSources!.push({ name: 'heartbeat', type: 'PingSource', status: 'True', reason: 'Ready' });
    }
    if (objs.secrets.length && faker.datatype.boolean()) {
      const ok = faker.datatype.boolean({ probability: 0.7 });
      sources.push({
        name: 'orders',
        kafkaSourceConfiguration: {
          bootstrapServers: [`kafka.${cluster}.example.com:9092`],
          topics: [`${ns}.${dns(faker.word.noun())}`],
          consumerGroup: `${name}-group`,
          consumers: faker.number.int({ min: 1, max: 3 }),
          secretRef: faker.helpers.arrayElement(objs.secrets).name,
        },
      });
      eventing.eventSources!.push({
        name: 'orders',
        type: 'KafkaSource',
        status: ok ? 'True' : 'False',
        ...(ok ? { reason: 'Ready' } : { reason: 'ConnectionFailed', message: 'could not reach bootstrap server' }),
      });
    }
    if (sources.length) {
      capp.eventSourcesSpec = { sources };
      capp.status.eventingStatus = eventing;
    }
  }

  if (objs.pullSecrets.length && faker.datatype.boolean({ probability: 0.5 })) {
    capp.imagePullSecrets = [faker.helpers.arrayElement(objs.pullSecrets).name];
  }

  return capp;
}

/**
 * Fills `store` with 3 clusters of namespaces, capps, configmaps and secrets.
 * @param seed  defaults to MOCK_SEED (if numeric) else random
 * @param now   reference time in ms (override for byte-identical output across runs)
 * @returns the seed used (log it so a run can be reproduced)
 */
export function seedStore(store: MockStore, seed?: number, now: number = Date.now()): number {
  const envSeed = process.env.MOCK_SEED ? Number.parseInt(process.env.MOCK_SEED, 10) : NaN;
  const used = seed ?? (Number.isFinite(envSeed) ? envSeed : faker.number.int({ min: 1, max: 2 ** 31 - 1 }));
  faker.seed(used);
  store.reset();

  for (const meta of genClusters()) {
    const nsCount = faker.number.int({ min: 3, max: 6 });
    const nsNames = new Set<string>();
    const nsList: string[] = [];
    for (let i = 0; i < nsCount; i++) {
      nsList.push(uniqueName(nsNames, () => `${faker.word.noun()}-${faker.helpers.arrayElement(['dev', 'prod', 'staging', 'team'])}`));
    }
    if (faker.datatype.boolean({ probability: 0.4 })) meta.allowedNamespaces = nsList.slice(0, Math.max(2, nsCount - 1));
    store.addCluster(meta);

    nsList.forEach((ns, nsIndex) => {
      const pods = faker.helpers.arrayElement([20, 50, 100]);
      const item: NamespaceItem = {
        name: ns,
        status: 'Active',
        canEdit: faker.datatype.boolean({ probability: 0.75 }),
        quota: {
          cpu: `${faker.helpers.arrayElement([4, 8, 16])}`,
          memory: `${faker.helpers.arrayElement([8, 16, 32])}Gi`,
          pods,
          used: {
            cpu: `${faker.number.int({ min: 100, max: 3000 })}m`,
            memory: `${faker.number.int({ min: 256, max: 6000 })}Mi`,
            pods: faker.number.int({ min: 0, max: Math.floor(pods / 2) }),
          },
        },
        users: Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () => faker.internet.email().toLowerCase()),
      };
      store.putNamespace(meta.name, item);

      const secretNames = new Set<string>();
      const secrets = Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () =>
        genSecret(ns, uniqueName(secretNames, () => `${faker.word.noun()}-${faker.helpers.arrayElement(['credentials', 'tls', 'token'])}`), store.allocResourceVersion(), now),
      );
      const cmNames = new Set<string>();
      const configMaps = Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () =>
        genConfigMap(ns, uniqueName(cmNames, () => `${faker.word.noun()}-${faker.helpers.arrayElement(['config', 'settings', 'env'])}`), store.allocResourceVersion(), now),
      );
      // Image pull secrets: always in the first namespace, sometimes elsewhere.
      // Kept out of `secrets` so capps never reference them via env/volumes.
      const pullSecrets = nsIndex === 0 || faker.datatype.boolean({ probability: 0.5 })
        ? [genPullSecret(ns, secretNames, store.allocResourceVersion(), now)]
        : [];
      [...secrets, ...pullSecrets].forEach((s) => store.putSecret(meta.name, s));
      configMaps.forEach((m) => store.putConfigMap(meta.name, m));

      const cappNames = new Set<string>();
      const volNames = new Set<string>();
      const cappCount = faker.number.int({ min: 2, max: 8 });
      for (let i = 0; i < cappCount; i++) {
        const name = uniqueName(cappNames, () => `${faker.word.adjective()}-${faker.word.noun()}`);
        store.putCapp(meta.name, genCapp(name, ns, meta.name, { secrets, configMaps, pullSecrets }, store.allocResourceVersion(), now, volNames));
      }
    });
  }
  return used;
}
