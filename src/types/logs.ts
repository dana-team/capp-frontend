// Events of the Capp log stream (GET .../capps/:name/logs), mirroring
// capp-backend pkg/api/capps/logs.go.

/** One line of a container's log (`log` event). */
export interface CappLogLine {
  pod: string
  container: string
  /** RFC 3339 time the kubelet recorded the line; absent when it came without one. */
  timestamp?: string
  line: string
}

/** A pod started or stopped being followed (`pod-started`, `pod-ended`). */
export interface CappLogPodEvent {
  pod: string
  reason?: string
}

/** A message about the stream itself (`notice`, `error`, `end`). */
export interface CappLogNotice {
  message: string
}

export type CappLogEvent =
  | { type: 'log'; data: CappLogLine }
  | { type: 'pod-started'; data: CappLogPodEvent }
  | { type: 'pod-ended'; data: CappLogPodEvent }
  | { type: 'notice'; data: CappLogNotice }
  | { type: 'error'; data: CappLogNotice }
  | { type: 'end'; data: CappLogNotice }

export interface CappLogStreamOptions {
  /** Lines of history per pod before following (backend default 100, max 1000). */
  tailLines?: number
  /** Follow this pod only. */
  pod?: string
}
