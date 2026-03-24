# Dockerfile, Helm Chart, and Release Flow Design

**Date:** 2026-03-14
**Repo:** `dana-team/capp-frontend`

## Overview

Add production packaging to the `capp-frontend` project: a multi-stage Dockerfile, a Helm chart supporting two deployment modes, and a GitHub Actions release workflow that publishes both artifacts to GHCR on git tag push.

---

## 1. Dockerfile

A two-stage build:

**Stage 1 — `builder` (`node:20-alpine`)**
- Copy `package.json` + `package-lock.json`, run `npm ci`
- Copy source, run `npm run build` → produces `dist/`

**Stage 2 — `runner` (`caddy:2-alpine`)**
- Copy `dist/` into `/srv`
- Copy `Caddyfile` into `/etc/caddy/Caddyfile`
- Listens on port `8080`

**Note on production API requests:** In production (`import.meta.env.DEV === false`), `src/api/client.ts` sends requests directly from the browser to the user-supplied cluster URL. The Vite dev proxy only exists to handle the `localhost` origin CORS problem during local development. In production the app is served from a real domain, and cluster operators are expected to configure their K8s API server CORS allowlist accordingly. The Docker image is a static file server only — no reverse proxy is included.

### Caddyfile

```caddy
:8080

root * /srv
file_server
try_files {path} /index.html
```

This serves static assets and falls back to `index.html` for all unmatched paths, enabling client-side routing (React Router).

---

## 2. Helm Chart

Location: `helm/capp-frontend/`

### Structure

```
helm/capp-frontend/
  Chart.yaml
  values.yaml
  templates/
    _helpers.tpl
    deployment.yaml      # rendered when deploymentMode=deployment
    service.yaml         # rendered when deploymentMode=deployment
    ingress.yaml         # rendered when deploymentMode=deployment, gated by ingress.enabled
    capp.yaml            # rendered when deploymentMode=capp
```

### Deployment Modes

A single `deploymentMode` value toggles between two mutually exclusive output sets:

- **`deployment`** — renders `Deployment` + `Service` + optional `Ingress`
- **`capp`** — renders a `Capp` CR (`rcs.dana.io/v1alpha1`)

### `values.yaml`

```yaml
deploymentMode: deployment   # "deployment" | "capp"

image:
  repository: ghcr.io/dana-team/capp-frontend
  tag: ""                    # defaults to .Chart.AppVersion; rendered as {{ .Values.image.tag | default .Chart.AppVersion }}
  pullPolicy: IfNotPresent

replicaCount: 1              # deployment mode only; ignored in capp mode (Knative autoscaling handles scaling)

env: []                      # [{name: FOO, value: bar}] — applied in both modes

service:
  port: 8080                 # deployment mode only — Service port; targetPort is always 8080 (the container port)

ingress:
  enabled: false             # deployment mode only
  host: ""
  tls: false
  className: ""              # spec.ingressClassName — required on Kubernetes 1.22+

imagePullSecrets: []         # e.g. [{name: ghcr-secret}] — needed if cluster is not authenticated to GHCR
```

### Scoped Capp fields

This Helm chart intentionally covers only the minimal surface of the Capp spec: `image`, `env`. The following Capp fields are **not** exposed as Helm values in this version and must be configured by editing the manifest directly if needed: `scaleMetric`, `state`, `routeSpec`, `logSpec`, `volumesSpec`, `sources`.

### Capp Template Mapping

`image` and `env` map into the Capp spec as:

```yaml
apiVersion: rcs.dana.io/v1alpha1
kind: Capp
metadata:
  name: {{ .Release.Name }}
  namespace: {{ .Release.Namespace }}
spec:
  configurationSpec:
    template:
      spec:
        containers:
          - image: <image.repository>:<image.tag | .Chart.AppVersion>
            env:
              - name: FOO
                value: bar
```

### Chart Metadata

- `Chart.yaml` `version` and `appVersion` are always kept in sync with the git tag — tag `v1.2.3` produces chart version `1.2.3` and appVersion `v1.2.3`.
- Both are overridden at package time via `--version` and `--app-version` flags.

---

## 3. Release Flow

**File:** `.github/workflows/release.yaml`

**Trigger:** `push` to tags matching `v*.*.*`

### Steps

1. **Checkout** — `actions/checkout@v4`
2. **Log in to GHCR** — `docker/login-action` using `GITHUB_TOKEN`
3. **Build & push Docker image**
   - Tool: `docker/build-push-action`
   - Tags: `ghcr.io/dana-team/capp-frontend:<tag>` and `ghcr.io/dana-team/capp-frontend:latest`
   - Version extracted from `github.ref_name` (e.g., `v1.2.3`)
4. **Set up Helm** — `azure/setup-helm@v4`
5. **Package Helm chart**
   - `helm package helm/capp-frontend --version <semver> --app-version <tag>`
   - `<semver>` strips the leading `v` from the tag (e.g., `v1.2.3` → `1.2.3`); `appVersion` retains the `v` prefix (chart `version` must be valid SemVer without `v`; `appVersion` is a free-form string)
6. **Push Helm chart to GHCR (OCI)**
   - `helm push capp-frontend-<semver>.tgz oci://ghcr.io/dana-team/helm-charts`

**Note on `imagePullSecrets`:** Applies only to `deploymentMode: deployment` (wired into `spec.template.spec.imagePullSecrets` in the Deployment template). Silently ignored in `capp` mode — the Capp CRD does not expose this field at the spec level.

All steps use `GITHUB_TOKEN` — no external secrets required.

### Published Artifacts

| Artifact | Registry path |
|---|---|
| Docker image | `ghcr.io/dana-team/capp-frontend:v1.2.3` |
| Helm chart (OCI) | `ghcr.io/dana-team/helm-charts/capp-frontend:1.2.3` |

---

## File Inventory

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage Caddy-based production image |
| `Caddyfile` | Caddy config: serve `/srv` on `:8080`, SPA fallback |
| `helm/capp-frontend/Chart.yaml` | Chart metadata |
| `helm/capp-frontend/values.yaml` | Default values |
| `helm/capp-frontend/templates/_helpers.tpl` | Shared template helpers |
| `helm/capp-frontend/templates/deployment.yaml` | K8s Deployment resource |
| `helm/capp-frontend/templates/service.yaml` | K8s Service resource |
| `helm/capp-frontend/templates/ingress.yaml` | K8s Ingress resource (optional) |
| `helm/capp-frontend/templates/capp.yaml` | Capp CR resource |
| `.github/workflows/release.yaml` | Release workflow |
