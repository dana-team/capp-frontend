/**
 * Capp status conditions: one condition per
 * capability configured in the capp spec, plus `Ready` pointing that represent the overall status.
 */
import type { CappResponse, ConditionResponse } from '../src/types/capp';

export type Capability = 'Volumes' | 'Serving' | 'Route' | 'Eventing' | 'Logging';

/** Checked in this order when picking the root cause. */
const CAPABILITIES: Capability[] = ['Volumes', 'Serving', 'Route', 'Eventing', 'Logging'];

const DEPENDS_ON: Partial<Record<Capability, Capability>> = {
  Serving: 'Volumes',
  Route: 'Serving',
  Eventing: 'Serving',
};

export interface Failure {
  capability: Capability;
  status: 'False' | 'Unknown';
  reason: string;
  message: string;
}

type Value = Pick<ConditionResponse, 'status' | 'reason' | 'message'>;

type CappSpec =Pick<CappResponse, 'name' | 'state' | 'nfsVolumes' | 'routeSpec' | 'eventSourcesSpec' | 'logSpec'>;

export function requiredCapabilities(c: CappSpec): Capability[] {
  const enabled = (c.state ?? 'enabled') === 'enabled';
  return CAPABILITIES.filter((cap) => {
    switch (cap) {
      case 'Volumes': return !!c.nfsVolumes?.length;
      case 'Serving': return enabled;
      case 'Route': return enabled && !!c.routeSpec?.hostname;
      case 'Eventing': return enabled && !!c.eventSourcesSpec?.sources?.length;
      case 'Logging': return !!c.logSpec;
    }
  });
}

/** The child a capability's symptom message names. */
function child(c: CappSpec, cap: Capability): string {
  switch (cap) {
    case 'Volumes': return `NfsPvc ${c.nfsVolumes?.[0]?.name}`;
    case 'Serving': return `Revision ${c.name}-00001`;
    case 'Route': return `DomainMapping ${c.routeSpec?.hostname}`;
    case 'Eventing': {
      const sources = c.eventSourcesSpec?.sources ?? [];
      const s = sources.find((x) => x.kafkaSourceConfiguration) ?? sources[0];
      return `${s?.kafkaSourceConfiguration ? 'KafkaSource' : 'PingSource'} ${s?.name}`;
    }
    case 'Logging': return `SyslogNGFlow ${c.name}`;
  }
}

/**
 * A capability whose dependency is not True reports a symptom; Ready skips it.
 * Follows the immediate dependency: an Unknown dependency keeps it Unknown too.
 */
function symptom(c: CappSpec, cap: Capability, dep: Value): Value {
  if (dep.status === 'Unknown' || cap === 'Serving') {
    return { status: 'Unknown', reason: 'Pending', message: `${child(c, cap)} not observed yet` };
  }
  return cap === 'Route'
    ? { status: 'False', reason: 'ResolveFailed', message: `${child(c, cap)}: service "${c.name}" has no ready revision` }
    : { status: 'False', reason: 'SinkNotReady', message: `${child(c, cap)}: sink "${c.name}" is not ready` };
}

/** Capability conditions plus Ready. `failure` must be on a required capability. */
export function cappConditions(c: CappSpec, t: string, failure?: Failure): ConditionResponse[] {
  const caps = requiredCapabilities(c);
  const values = new Map<Capability, Value>();
  for (const cap of caps) {
    if (failure?.capability === cap) {
      const { capability: _, ...v } = failure;
      values.set(cap, v);
      continue;
    }
    const dep = DEPENDS_ON[cap];
    const depValue = dep && values.get(dep);
    values.set(cap, depValue && depValue.status !== 'True'
      ? symptom(c, cap, depValue)
      : { status: 'True' as const, reason: 'Ready', message: '' });
  }

  const conds: ConditionResponse[] = caps.map((cap) => ({
    type: `${cap}Ready`,
    lastTransitionTime: t,
    ...values.get(cap)!,
  }));

  let ready: ConditionResponse;
  if ((c.state ?? 'enabled') === 'disabled') {
    ready = { type: 'Ready', status: 'True', reason: 'Disabled', message: '', lastTransitionTime: t };
  } else {
    const roots = caps.filter((cap) => {
      const v = values.get(cap)!;
      if (v.status === 'True') return false;
      if (v.reason === 'ResourceSyncFailed') return true;
      const dep = DEPENDS_ON[cap];
      return !dep || !caps.includes(dep) || values.get(dep)!.status === 'True';
    });
    const root = roots.find((cap) => values.get(cap)!.status === 'False') ?? roots[0];
    if (!root) {
      ready = { type: 'Ready', status: 'True', reason: 'Ready', message: '', lastTransitionTime: t };
    } else {
      const v = values.get(root)!;
      ready = { type: 'Ready', status: v.status, reason: `${root}NotReady`, message: `${v.reason}: ${v.message}`, lastTransitionTime: t };
    }
  }
  return [ready, ...conds];
}

/** Plausible root-cause failures for a capability. */
export function failuresFor(c: CappSpec & Pick<CappResponse, 'image'>, cap: Capability): Failure[] {
  const f = (reason: string, message: string, status: Failure['status'] = 'False'): Failure =>
    ({ capability: cap, status, reason, message });
  const name = child(c, cap);
  switch (cap) {
    case 'Volumes':
      return [f('ProvisioningFailed', `${name}: NFS server not reachable`)];
    case 'Serving':
      return [
        f('ContainerMissing', `${name}: Unable to fetch image "${c.image}"`),
        f('ExitCode1', `${name}: Container failed with: exit code 1`),
        f('ExceededQuota', `${name}: exceeded quota: compute-resources`),
      ];
    case 'Route':
      return [
        f('ReconcileError', `CNAMERecord ${c.routeSpec?.hostname}: cannot authenticate with DNS provider`),
        f('ResourceSyncFailed', `admission webhook denied the request: hostname ${c.routeSpec?.hostname} is already in use`),
        ...(c.routeSpec?.tlsEnabled ? [f('IssuerNotReady', `Certificate ${c.routeSpec.hostname}: issuer is not ready`)] : []),
      ];
    case 'Eventing':
      return [f('ConnectionFailed', `${name}: could not reach bootstrap server`)];
    case 'Logging':
      return [f('ProblemsFound', `SyslogNGOutput ${c.name}: connection refused to ${c.logSpec?.host}`)];
  }
}

/** A capability that is still rolling out, e.g. a new revision deploying. */
export function progressing(c: CappSpec): Failure {
  return { capability: 'Serving', status: 'Unknown', reason: 'Deploying', message: `Revision ${c.name}-00002: waiting for the revision to become ready` };
}
