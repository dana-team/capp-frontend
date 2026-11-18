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
- **Capp logs** (`src/api/logs.ts`, `src/hooks/useCappLogStream.ts`, `src/components/capps/CappLogs.tsx`) read the backend's Server-Sent Events stream with `fetch` (via `backendFetch`, so auth/refresh apply), not `EventSource`, which cannot send the Authorization header. The parser is `src/utils/sse.ts`. The stream opens on request, keeps the last 5000 lines, and reconnects without history after the backend's `end` event or a dropped connection. `npm run dev:mock` serves a fake stream (`mock-server/logs.ts`).

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
/functions[/new|/:namespace/:name[/edit]]  → cfunc Functions (list, create, detail, edit)
/pools[/new|/:namespace/:name[/edit]]      → cfunc Pools, shown under the Functions tab
```
cfunc has one top-bar tab, Functions. `CfuncHeader` (`src/components/cfunc/`) gives its two list pages the same title, both create buttons and the Functions | Pools switch. The tab shows only when the backend serves cfunc: `useCfuncFeatures` (`src/hooks/useCfunc.ts`) probes `/api/v1/cfunc/flavors` (a 404 hides the tab) and the functions list (a 404 leaves only the Pools view). Their code is in `src/components/cfunc/`, `src/api/cfunc.ts` and `src/types/cfunc.ts`. The mock server (`mock-server/cfunc.ts`) serves both; `MOCK_CFUNC=off` or `MOCK_CFUNC=pools` turns them off.
All non-login routes are wrapped by `AppShell` (sidebar layout) and `NamespaceProvider`.

### Path Alias
`@/*` maps to `src/*` — use `@/components/...` instead of relative imports.

### Styling
Tailwind CSS with a dark theme. Key custom tokens: background `#09090f`, surface `#111118`, primary `#7c3aed` (violet). Use `cn()` from `src/components/ui/cn.ts` (clsx + tailwind-merge) for conditional classes.

### Capp Forms
`CappForm` is shared by Create and Edit pages. It uses React Hook Form + Zod. Form sections (Details, Configuration, Route, Sources, Volumes, Log) are collapsible accordions in `src/components/capps/sections/`. The `cappBuilder` utility (`src/utils/cappBuilder.ts`) converts form values to Kubernetes resource manifests.
