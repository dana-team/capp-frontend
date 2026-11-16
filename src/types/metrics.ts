/** One metric configured on the backend under resources.observability.metrics. */
export interface MetricInfo {
  name: string
  description?: string
  /** Display hint: gauge, counter, or histogram. */
  type: string
  unit?: string
  /** The metric's lines, in the order `series` is returned. */
  legends: string[]
}

export interface MetricListResponse {
  items: MetricInfo[]
}

/** Prometheus matrix entry: one labelled line of a range query. */
export interface PrometheusMatrixSeries {
  metric?: Record<string, string>
  values?: [number, string][]
}

/** One line of a metric. `result` is Prometheus `data.result`, unchanged. */
export interface MetricSeriesResult {
  legend: string
  resultType: 'vector' | 'matrix' | 'scalar' | 'string'
  result: unknown
}

/** Returned by GET .../capps/:name/metrics/:metric. */
export interface MetricQueryResponse extends MetricInfo {
  series: MetricSeriesResult[]
  warnings?: string[]
  infos?: string[]
}
