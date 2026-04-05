{{/*
Expand the name of the chart.
*/}}
{{- define "capp-frontend.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
Truncated to 63 characters (Kubernetes label limit).
*/}}
{{- define "capp-frontend.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart label: name-version with + replaced by _ (OCI-safe).
*/}}
{{- define "capp-frontend.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to all resources.
*/}}
{{- define "capp-frontend.labels" -}}
helm.sh/chart: {{ include "capp-frontend.chart" . }}
{{ include "capp-frontend.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels used in Deployment.spec.selector.matchLabels and Service.spec.selector.
These must remain stable after first deployment — changing them forces pod recreation.
*/}}
{{- define "capp-frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "capp-frontend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
ServiceAccount name: uses .Values.serviceAccount.name if set, otherwise falls back to fullname.
*/}}
{{- define "capp-frontend.serviceAccountName" -}}
{{- if .Values.serviceAccount.name }}
{{- .Values.serviceAccount.name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- include "capp-frontend.fullname" . }}
{{- end }}
{{- end }}

{{/*
Full image reference: repository:tag, where tag falls back to .Chart.AppVersion.
An empty .Values.image.tag uses .Chart.AppVersion via Helm's `default` filter
(empty string is falsy in Helm template expressions).
*/}}
{{- define "capp-frontend.image" -}}
{{- printf "%s:%s" .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- end }}
