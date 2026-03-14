export function relativeTime(timestamp: string | undefined): string {
  if (!timestamp) return '—';

  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  if (diffSecs < 86400 * 30) return `${Math.floor(diffSecs / 86400)}d ago`;
  if (diffSecs < 86400 * 365) return `${Math.floor(diffSecs / (86400 * 30))}mo ago`;
  return `${Math.floor(diffSecs / (86400 * 365))}y ago`;
}

export function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString();
}
