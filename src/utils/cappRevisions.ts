import yaml from 'js-yaml';
import { BareCappResponse } from '@/types/capp';

type Template = Omit<BareCappResponse, 'name' | 'namespace' | 'createdAt' | 'uid' | 'resourceVersion'>;

/** Object identity, status and response-only fields: not part of what a revision records. */
const NON_TEMPLATE_KEYS = ['name', 'namespace', 'createdAt', 'uid', 'resourceVersion', 'status', 'warnings', 'drift', 'revisionNumber'];

/** The part of a Capp a revision records: spec, labels and annotations. */
export function cappTemplate(capp: BareCappResponse): Template {
  const tmpl: Record<string, unknown> = { ...capp };
  for (const k of NON_TEMPLATE_KEYS) delete tmpl[k];
  return tmpl as Template;
}

/** YAML of the Capp template with sorted keys, so diffs line up regardless of field order. */
export function templateYaml(capp: BareCappResponse): string {
  return yaml.dump(cappTemplate(capp), { indent: 2, sortKeys: true, lineWidth: -1 });
}

/** Top-level template fields that differ between two versions, sorted. */
export function changedFields(a: BareCappResponse, b: BareCappResponse): string[] {
  const ta = cappTemplate(a) as Record<string, unknown>;
  const tb = cappTemplate(b) as Record<string, unknown>;
  const keys = new Set([...Object.keys(ta), ...Object.keys(tb)]);
  return [...keys]
    .filter((k) => yaml.dump(ta[k] ?? null, { sortKeys: true }) !== yaml.dump(tb[k] ?? null, { sortKeys: true }))
    .sort();
}
