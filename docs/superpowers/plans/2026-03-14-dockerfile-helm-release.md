# Dockerfile, Helm Chart, and Release Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package capp-frontend as a production Docker image served by Caddy, add a Helm chart with `deployment` and `capp` deployment modes, and publish both via GitHub Actions on git tag push.

**Architecture:** Multi-stage Dockerfile (node builder → caddy runner) produces a ~30MB static file server image. A single Helm chart at `helm/capp-frontend/` uses a `deploymentMode` toggle to render either a standard K8s `Deployment`+`Service`+`Ingress` or a `Capp` CR (`rcs.dana.io/v1alpha1`). A GitHub Actions workflow triggers on `v*.*.*` tags, builds the image and packages the chart, then pushes both to GHCR.

**Tech Stack:** Docker (multi-stage), Caddy v2, Helm 3 (OCI), GitHub Actions, GHCR

---

## Chunk 1: Dockerfile and Caddyfile

### Task 1: Create Caddyfile

**Files:**
- Create: `Caddyfile`

- [ ] **Step 1: Create `Caddyfile` at repo root**

```
:8080

root * /srv
file_server
try_files {path} /index.html
```

Explanation: `:8080` binds Caddy to port 8080 (non-root). `root * /srv` sets the document root to where the built assets will be copied. `file_server` enables static file serving. `try_files {path} /index.html` is the SPA fallback — any path not matching a real file serves `index.html` so React Router handles it client-side.

- [ ] **Step 2: Commit**

```bash
git add Caddyfile
git commit -m "chore: add Caddyfile for production static file serving"
```

---

### Task 2: Create Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create `Dockerfile` at repo root**

```dockerfile
# Stage 1: Build the Vite app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with Caddy
FROM caddy:2-alpine AS runner

# Copy built assets into Caddy's default serve directory
COPY --from=builder /app/dist /srv

# Copy Caddy configuration
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 8080
```

Notes:
- `npm ci` (not `npm install`) ensures a clean, reproducible install from `package-lock.json`
- The `COPY . .` comes after `npm ci` so the npm install layer is cached unless `package.json` changes
- `EXPOSE 8080` is documentation only; the actual port binding happens at runtime

- [ ] **Step 2: Add `.dockerignore` to prevent copying `node_modules` and `dist` into the build context**

Create `.dockerignore` at repo root:

```
node_modules
dist
.git
*.md
docs/
```

- [ ] **Step 3: Verify the build locally (optional — requires Docker)**

```bash
docker build -t capp-frontend:local .
```

Expected: build completes, final image is `caddy:2-alpine`-based, no node_modules in the runner stage.

To test serving:
```bash
docker run --rm -p 8080:8080 capp-frontend:local
# Open http://localhost:8080 — should serve the app
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "chore: add multi-stage Dockerfile with Caddy static file server"
```

---

## Chunk 2: Helm Chart Scaffold

### Task 3: Create Chart.yaml and values.yaml

**Files:**
- Create: `helm/capp-frontend/Chart.yaml`
- Create: `helm/capp-frontend/values.yaml`

- [ ] **Step 1: Create `helm/capp-frontend/Chart.yaml`**

```yaml
apiVersion: v2
name: capp-frontend
description: Kubernetes UI management console for Capps (rcs.dana.io/v1alpha1)
type: application
version: 0.1.0
appVersion: "0.1.0"
```

Notes:
- `apiVersion: v2` is required for Helm 3
- `version` is the chart version (semver, no `v` prefix); `appVersion` is the app image tag
- Both are overridden at release time via `helm package --version` and `--app-version`

- [ ] **Step 2: Create `helm/capp-frontend/values.yaml`**

```yaml
# deploymentMode controls which resource is rendered:
#   "deployment" — renders a Deployment + Service + optional Ingress
#   "capp"       — renders a Capp CR (rcs.dana.io/v1alpha1)
deploymentMode: deployment

image:
  repository: ghcr.io/dana-team/capp-frontend
  # tag defaults to .Chart.AppVersion when empty
  tag: ""
  pullPolicy: IfNotPresent

# Number of replicas. Only applies when deploymentMode=deployment.
# Capp uses Knative autoscaling; this value is ignored in capp mode.
replicaCount: 1

# Environment variables passed to the container in both deployment modes.
# Format: [{name: FOO, value: bar}]
env: []

# Service configuration. Only applies when deploymentMode=deployment.
service:
  # Service port. targetPort is always 8080 (the container port).
  port: 8080

# Ingress configuration. Only applies when deploymentMode=deployment.
ingress:
  enabled: false
  host: ""
  tls: false
  # ingressClassName is required on Kubernetes 1.22+
  className: ""

# Image pull secrets. Only applies when deploymentMode=deployment.
# Needed if the cluster is not already authenticated to GHCR.
# Example: [{name: ghcr-secret}]
imagePullSecrets: []
```

- [ ] **Step 3: Run `helm lint` to verify the chart is structurally valid**

```bash
helm lint helm/capp-frontend
```

Expected output:
```
==> Linting helm/capp-frontend
[INFO] Chart.yaml: icon is recommended

1 chart(s) linted, 0 chart(s) failed
```

The icon warning is informational only and does not block usage.

- [ ] **Step 4: Commit**

```bash
git add helm/capp-frontend/Chart.yaml helm/capp-frontend/values.yaml
git commit -m "chore: add helm chart scaffold with Chart.yaml and values.yaml"
```

---

### Task 4: Create _helpers.tpl

**Files:**
- Create: `helm/capp-frontend/templates/_helpers.tpl`

- [ ] **Step 1: Create `helm/capp-frontend/templates/_helpers.tpl`**

```
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
Full image reference: repository:tag, where tag falls back to .Chart.AppVersion.
An empty .Values.image.tag uses .Chart.AppVersion via Helm's `default` filter
(empty string is falsy in Helm template expressions).
*/}}
{{- define "capp-frontend.image" -}}
{{- printf "%s:%s" .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- end }}
```

- [ ] **Step 2: Run `helm lint` to verify no template errors**

```bash
helm lint helm/capp-frontend
```

Expected: `1 chart(s) linted, 0 chart(s) failed`

- [ ] **Step 3: Commit**

```bash
git add helm/capp-frontend/templates/_helpers.tpl
git commit -m "chore: add helm chart template helpers"
```

---

## Chunk 3: Helm Deployment Mode Templates

### Task 5: Create deployment.yaml

**Files:**
- Create: `helm/capp-frontend/templates/deployment.yaml`

- [ ] **Step 1: Create `helm/capp-frontend/templates/deployment.yaml`**

```yaml
{{- if eq .Values.deploymentMode "deployment" }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "capp-frontend.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "capp-frontend.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "capp-frontend.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "capp-frontend.labels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: {{ .Chart.Name }}
          image: {{ include "capp-frontend.image" . }}
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
          {{- if .Values.env }}
          env:
            {{- toYaml .Values.env | nindent 12 }}
          {{- end }}
{{- end }}
```

- [ ] **Step 2: Verify the rendered output with `helm template`**

```bash
helm template my-release helm/capp-frontend
```

Expected: a `Deployment` resource is rendered with `replicas: 1`, `containerPort: 8080`, no `env` block (since `env: []` by default).

- [ ] **Step 3: Verify with overrides**

```bash
helm template my-release helm/capp-frontend \
  --set replicaCount=3 \
  --set env[0].name=FOO \
  --set env[0].value=bar
```

Expected: `replicas: 3` and an `env` block with `FOO=bar`.

- [ ] **Step 4: Verify deployment mode toggle suppresses the Deployment**

```bash
helm template my-release helm/capp-frontend --set deploymentMode=capp
```

Expected: no `Deployment` resource in the output (only empty output until capp.yaml is added in Task 8).

- [ ] **Step 5: Commit**

```bash
git add helm/capp-frontend/templates/deployment.yaml
git commit -m "chore: add helm Deployment template for deployment mode"
```

---

### Task 6: Create service.yaml

**Files:**
- Create: `helm/capp-frontend/templates/service.yaml`

- [ ] **Step 1: Create `helm/capp-frontend/templates/service.yaml`**

```yaml
{{- if eq .Values.deploymentMode "deployment" }}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "capp-frontend.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "capp-frontend.labels" . | nindent 4 }}
spec:
  selector:
    {{- include "capp-frontend.selectorLabels" . | nindent 4 }}
  ports:
    - name: http
      port: {{ .Values.service.port }}
      targetPort: 8080
      protocol: TCP
{{- end }}
```

Note: `targetPort: 8080` is hardcoded — it always matches the container's `containerPort`. `service.port` controls only the Service-level port (e.g., set to `80` to expose on port 80 while the container listens on 8080).

- [ ] **Step 2: Verify rendered output**

```bash
helm template my-release helm/capp-frontend
```

Expected: both `Deployment` and `Service` are rendered. Service has `port: 8080` and `targetPort: 8080`.

- [ ] **Step 3: Commit**

```bash
git add helm/capp-frontend/templates/service.yaml
git commit -m "chore: add helm Service template for deployment mode"
```

---

### Task 7: Create ingress.yaml

**Files:**
- Create: `helm/capp-frontend/templates/ingress.yaml`

- [ ] **Step 1: Create `helm/capp-frontend/templates/ingress.yaml`**

```yaml
{{- if and (eq .Values.deploymentMode "deployment") .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "capp-frontend.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "capp-frontend.labels" . | nindent 4 }}
spec:
  {{- if .Values.ingress.className }}
  ingressClassName: {{ .Values.ingress.className }}
  {{- end }}
  {{- if .Values.ingress.tls }}
  tls:
    - hosts:
        - {{ .Values.ingress.host }}
      secretName: {{ include "capp-frontend.fullname" . }}-tls
  {{- end }}
  rules:
    - host: {{ .Values.ingress.host }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ include "capp-frontend.fullname" . }}
                port:
                  number: {{ .Values.service.port }}
{{- end }}
```

- [ ] **Step 2: Verify Ingress is NOT rendered by default**

```bash
helm template my-release helm/capp-frontend
```

Expected: no `Ingress` resource (since `ingress.enabled: false` by default).

- [ ] **Step 3: Verify Ingress renders correctly when enabled**

```bash
helm template my-release helm/capp-frontend \
  --set ingress.enabled=true \
  --set ingress.host=capp.example.com \
  --set ingress.className=nginx \
  --set ingress.tls=true
```

Expected: `Ingress` resource with `ingressClassName: nginx`, a `tls` block with host `capp.example.com` and `secretName: my-release-capp-frontend-tls`, and a rule routing `/` to the Service.

- [ ] **Step 4: Run `helm lint` on the full chart**

```bash
helm lint helm/capp-frontend
```

Expected: `1 chart(s) linted, 0 chart(s) failed`

- [ ] **Step 5: Commit**

```bash
git add helm/capp-frontend/templates/ingress.yaml
git commit -m "chore: add helm Ingress template for deployment mode"
```

---

## Chunk 4: Helm Capp Template

### Task 8: Create capp.yaml

**Files:**
- Create: `helm/capp-frontend/templates/capp.yaml`

- [ ] **Step 1: Create `helm/capp-frontend/templates/capp.yaml`**

```yaml
{{- if eq .Values.deploymentMode "capp" }}
apiVersion: rcs.dana.io/v1alpha1
kind: Capp
metadata:
  name: {{ .Release.Name }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "capp-frontend.labels" . | nindent 4 }}
spec:
  configurationSpec:
    template:
      spec:
        containers:
          - image: {{ include "capp-frontend.image" . }}
            {{- if .Values.env }}
            env:
              {{- toYaml .Values.env | nindent 14 }}
            {{- end }}
{{- end }}
```

Notes:
- `name: {{ .Release.Name }}` — the Capp is named after the Helm release (not `fullname`), matching Capp naming conventions
- `namespace: {{ .Release.Namespace }}` — uses Helm's release namespace, not a values field
- The following Capp fields are intentionally omitted in this version: `scaleMetric`, `state`, `routeSpec`, `logSpec`, `volumesSpec`, `sources`. Configure them by post-install patch or by extending this template.
- `imagePullSecrets` is not applicable in Capp mode — the Capp CRD does not expose this at the spec level

- [ ] **Step 2: Verify the Capp resource renders in capp mode**

```bash
helm template my-release helm/capp-frontend --set deploymentMode=capp
```

Expected: a single `Capp` resource with `apiVersion: rcs.dana.io/v1alpha1`, correct `name` and `namespace`, and the image reference. No `Deployment`, `Service`, or `Ingress`.

- [ ] **Step 3: Verify env vars render correctly in capp mode**

```bash
helm template my-release helm/capp-frontend \
  --set deploymentMode=capp \
  --set env[0].name=FOO \
  --set env[0].value=bar
```

Expected: the `containers[0]` block includes:
```yaml
env:
  - name: FOO
    value: bar
```

- [ ] **Step 4: Verify capp mode suppresses all deployment-mode resources**

```bash
helm template my-release helm/capp-frontend --set deploymentMode=capp | grep "kind:"
```

Expected output: only `kind: Capp` — no `Deployment`, `Service`, or `Ingress`.

- [ ] **Step 5: Verify deployment mode still works (regression check)**

```bash
helm template my-release helm/capp-frontend | grep "kind:"
```

Expected: `kind: Deployment` and `kind: Service` (no `Ingress` since it's disabled by default, no `Capp`).

- [ ] **Step 6: Run final `helm lint`**

```bash
helm lint helm/capp-frontend
helm lint helm/capp-frontend --set deploymentMode=capp
```

Expected: `1 chart(s) linted, 0 chart(s) failed` for both.

- [ ] **Step 7: Commit**

```bash
git add helm/capp-frontend/templates/capp.yaml
git commit -m "chore: add helm Capp CR template for capp deployment mode"
```

---

## Chunk 5: GitHub Actions Release Workflow

### Task 9: Create release workflow

**Files:**
- Create: `.github/workflows/release.yaml`

- [ ] **Step 1: Create `.github/workflows/release.yaml`**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

permissions:
  contents: read
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Extract version
        id: version
        run: |
          TAG="${{ github.ref_name }}"
          echo "tag=${TAG}" >> "$GITHUB_OUTPUT"
          echo "semver=${TAG#v}" >> "$GITHUB_OUTPUT"

      - name: Build and push Docker image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/dana-team/capp-frontend:${{ steps.version.outputs.tag }}
            ghcr.io/dana-team/capp-frontend:latest

      - name: Set up Helm
        uses: azure/setup-helm@v4

      - name: Package Helm chart
        run: |
          helm package helm/capp-frontend \
            --version "${{ steps.version.outputs.semver }}" \
            --app-version "${{ steps.version.outputs.tag }}"

      - name: Push Helm chart to GHCR
        run: |
          helm push \
            "capp-frontend-${{ steps.version.outputs.semver }}.tgz" \
            oci://ghcr.io/dana-team/helm-charts
```

Notes:
- `permissions: packages: write` is required for `GITHUB_TOKEN` to push to GHCR
- `TAG#v` strips the leading `v` from the tag for the Helm chart `--version` (Helm chart versions must be valid SemVer without a `v` prefix)
- `appVersion` retains the `v` prefix (`v1.2.3`) — it is a free-form string in Helm
- `docker/build-push-action@v6` automatically uses BuildKit
- No `actions/setup-node` is needed — `npm ci` runs inside the Docker build, not on the runner

- [ ] **Step 2: Verify the workflow file is valid YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yaml'))" && echo "Valid YAML"
```

Expected: `Valid YAML`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yaml
git commit -m "ci: add release workflow to build and publish image and helm chart on tag push"
```

---

## Summary

After all tasks complete, the repo will have:

| Artifact | Location | Published to |
|---|---|---|
| Docker image | `Dockerfile` + `Caddyfile` | `ghcr.io/dana-team/capp-frontend:v*` |
| Helm chart | `helm/capp-frontend/` | `ghcr.io/dana-team/helm-charts/capp-frontend:*` |
| Release workflow | `.github/workflows/release.yaml` | triggers on `v*.*.*` tag push |

**To install with Helm after a release:**

```bash
# Deployment mode (standard K8s)
helm install my-release oci://ghcr.io/dana-team/helm-charts/capp-frontend --version 1.2.3

# Capp mode
helm install my-release oci://ghcr.io/dana-team/helm-charts/capp-frontend --version 1.2.3 \
  --set deploymentMode=capp
```
