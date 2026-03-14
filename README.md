# capp-frontend

`capp-frontend` is a Kubernetes-native web management console for managing [**Capp**](https://github.com/dana-team/container-app-operator) (ContainerApp) custom resources on Kubernetes clusters.

It provides a clean, dark-themed UI for connecting to any Kubernetes cluster via a Bearer token and performing full lifecycle management of `Capp` resources — create, view, edit, and delete — without needing `kubectl` or deep Kubernetes knowledge.

## Features

- **Cluster Authentication** — Connect to any Kubernetes API server using a URL and a Bearer token.
- **Capp List View** — Browse, search, sort, and paginate `Capp` resources across namespaces.
- **Capp Detail View** — Inspect the full spec and live conditions (Knative, logging, routing, certificate) of a `Capp`.
- **Create / Edit Capps** — Form-driven workflow with sections for:
  - Container image, replicas, and scaling metrics (concurrency, RPS, CPU, memory)
  - Environment variables and container configuration
  - HTTP/HTTPS route with custom hostname
  - NFS volume mounts
  - Elasticsearch log output
  - Kafka / ActiveMQ event sources
- **Namespace Selector** — Switch the active namespace from the navigation bar.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18, TypeScript 5 |
| Build | Vite 5 |
| Routing | React Router v6 |
| Server state | TanStack React Query v5 |
| Global state | Zustand |
| Forms | React Hook Form + Zod |
| UI components | shadcn/ui (Radix UI primitives) |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| Animations | Motion |

## Prerequisites

- **Node.js** 20 LTS (or later)
- **npm** 9 or later
- Access to a Kubernetes cluster with the [`container-app-operator`](https://github.com/dana-team/container-app-operator) installed (provides the `rcs.dana.io/v1alpha1` API group)

## Getting Started

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

> **Note:** The dev server includes a dynamic reverse-proxy at `/k8s-proxy` that forwards requests to the configured Kubernetes API server, which avoids CORS issues during development. Alternatively, set the `VITE_K8S_URL` environment variable to point to your cluster.

### Build for production

```bash
npm run build
```

This runs `tsc` for type-checking and then `vite build`. The output is placed in the `dist/` directory.

### Preview the production build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

Runs ESLint over all `*.ts` and `*.tsx` files in `src/`.

## Project Structure

```
src/
├── api/            # Kubernetes API client and CRUD wrappers
├── components/     # Shared and feature-specific React components
│   ├── capps/      # Capp form, detail view, section accordions
│   ├── layout/     # AppShell, TopNav
│   └── ui/         # Generic UI primitives (Button, Input, Select, …)
├── context/        # NamespaceContext — selected namespace across pages
├── hooks/          # React Query hooks (useCapps, useNamespaces, …)
├── pages/          # Top-level page components
├── store/          # Zustand stores (auth — cluster URL + token)
├── types/          # Shared TypeScript types
└── utils/          # cappBuilder and other utilities
```

## Authentication

1. Navigate to `/login`.
2. Enter the Kubernetes API server URL (e.g. `https://my-cluster:6443`) and a valid Bearer token.
3. Credentials are validated against `/version` and persisted in `localStorage` via Zustand.
4. All other routes are protected and redirect to `/login` when unauthenticated.

## Routing

| Path | Page |
|---|---|
| `/login` | LoginPage |
| `/capps` | CappListPage |
| `/capps/new` | CreateCappPage |
| `/capps/:namespace/:name` | CappDetailPage |
| `/capps/:namespace/:name/edit` | EditCappPage |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

### Development tips

- Path alias `@/*` resolves to `src/*` — use it for all internal imports.
- The `cn()` utility (`src/lib/utils.ts`) combines `clsx` and `tailwind-merge` for conditional class names.
- New shadcn/ui components can be scaffolded with `npx shadcn add <component>`.
