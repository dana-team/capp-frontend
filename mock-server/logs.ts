/**
 * Mock of the Capp log stream (GET .../capps/:name/logs, text/event-stream).
 * Two pods start with history and print a line every second or so; a third
 * pod joins after 15 s and the first one ends after 40 s. The stream ends
 * with an `end` event after MOCK_LOG_STREAM_SECONDS (default 300), as the
 * backend does after 30 minutes.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

const STREAM_SECONDS = Number(process.env.MOCK_LOG_STREAM_SECONDS) || 300;
const MAX_TAIL_LINES = 1000;

const MESSAGES = [
  'GET /healthz 200 0.4ms',
  'GET /api/orders 200 12.8ms',
  'POST /api/orders 201 41.2ms',
  'GET /api/orders/8812 404 3.1ms',
  'cache hit ratio 0.93',
  'worker pool: 4 busy, 12 idle',
  'WARN slow query took 812ms: SELECT * FROM orders WHERE status = $1',
  'ERROR upstream payments-api timed out after 5000ms',
  'flushed 128 metrics to collector',
];

function podName(capp: string, revision: number, id: string): string {
  return `${capp}-${String(revision).padStart(5, '0')}-deployment-7c9f8d6b4-${id}`;
}

export function streamLogs(
  req: IncomingMessage,
  res: ServerResponse,
  capp: string,
  container: string,
  query: URLSearchParams,
  cors: Record<string, string>,
): boolean {
  const rawTail = query.get('tailLines');
  const tailLines = rawTail === null ? 100 : Number(rawTail);
  if (!Number.isInteger(tailLines) || tailLines < 0 || tailLines > MAX_TAIL_LINES) return false;
  const onlyPod = query.get('pod') ?? '';

  res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const timers: NodeJS.Timeout[] = [];
  const active = new Set<string>();

  const line = (pod: string, at: Date, text: string) =>
    send('log', { pod, container, timestamp: at.toISOString(), line: text });

  const startPod = (pod: string, history: number) => {
    if (onlyPod && pod !== onlyPod) return;
    active.add(pod);
    send('pod-started', { pod });
    const now = Date.now();
    for (let i = history; i > 0; i--) {
      line(pod, new Date(now - i * 1500), MESSAGES[(i + pod.length) % MESSAGES.length]);
    }
    let n = 0;
    const tick = setInterval(() => {
      if (!active.has(pod)) return clearInterval(tick);
      line(pod, new Date(), MESSAGES[(n++ * 7 + pod.length) % MESSAGES.length]);
    }, 700 + Math.floor(Math.random() * 900));
    timers.push(tick);
  };

  const endPod = (pod: string, reason: string) => {
    if (!active.delete(pod)) return;
    send('pod-ended', { pod, reason });
  };

  const a = podName(capp, 3, 'k2x9q');
  const b = podName(capp, 3, 'p7m4d');
  const c = podName(capp, 3, 'z1r8w');
  startPod(a, Math.min(tailLines, 40));
  startPod(b, Math.min(tailLines, 25));
  timers.push(setTimeout(() => startPod(c, Math.min(tailLines, 5)), 15_000));
  timers.push(setTimeout(() => endPod(a, 'pod deleted'), 40_000));
  timers.push(setInterval(() => res.write(': keepalive\n\n'), 15_000));
  timers.push(setTimeout(() => {
    send('end', { message: 'the stream reached its maximum duration; connect again to go on' });
    cleanup();
    res.end();
  }, STREAM_SECONDS * 1000));

  const cleanup = () => {
    active.clear();
    timers.forEach((t) => clearTimeout(t));
  };
  req.on('close', cleanup);
  return true;
}
