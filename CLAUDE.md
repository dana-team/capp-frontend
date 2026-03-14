# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 3000
npm run build      # Type-check + production build (tsc && vite build)
npm run preview    # Preview production build
npm run lint       # ESLint on src/ (.ts, .tsx)
```

No test runner is configured in this project.

## Architecture

This is a **Kubernetes UI management console** for "Capps" — custom resources in the `rcs.dana.io/v1alpha1` API group.

### Auth Flow
1. User enters cluster URL + Bearer token on `/login`
2. `LoginPage` validates by calling `k8sClient(/version)`
3. Credentials persist to localStorage via Zustand (`src/store/auth.ts`)
4. All protected routes redirect unauthenticated users to `/login`

### Data Flow
- **`src/api/client.ts`** — `k8sClient` function: injects Bearer token, throws `K8sApiError` on failures
- **`src/api/capps.ts`** / **`src/api/namespaces.ts`** — CRUD wrappers over `k8sClient`
- **`src/hooks/`** — TanStack React Query hooks (`useCapps`, `useNamespaces`) consumed by pages
- Pages are thin; domain logic lives in hooks and utils

### State Layers
| Layer | Tool | Scope |
|---|---|---|
| Auth (clusterUrl, token) | Zustand + localStorage | Global |
| Selected namespace | React Context (`NamespaceContext`) | Protected routes |
| Server data (capps, namespaces) | React Query | Cached/async |
| UI state | `useState` | Local |

### Routing
```
/login                          → LoginPage (public)
/capps                          → CappListPage
/capps/new                      → CreateCappPage
/capps/:namespace/:name         → CappDetailPage
/capps/:namespace/:name/edit    → EditCappPage
```
All non-login routes are wrapped by `AppShell` (sidebar layout) and `NamespaceProvider`.

### Path Alias
`@/*` maps to `src/*` — use `@/components/...` instead of relative imports.

### Styling
Tailwind CSS with a dark theme. Key custom tokens: background `#09090f`, surface `#111118`, primary `#7c3aed` (violet). Use `cn()` from `src/components/ui/cn.ts` (clsx + tailwind-merge) for conditional classes.

### Capp Forms
`CappForm` is shared by Create and Edit pages. It uses React Hook Form + Zod. Form sections (Details, Configuration, Route, Sources, Volumes, Log) are collapsible accordions in `src/components/capps/sections/`. The `cappBuilder` utility (`src/utils/cappBuilder.ts`) converts form values to Kubernetes resource manifests.
