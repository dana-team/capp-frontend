# capp-frontend

`capp-frontend` is a web management console for managing [**Capp**](https://github.com/dana-team/container-app-operator) (ContainerApp) custom resources on Kubernetes clusters. It communicates exclusively with [`capp-backend`](https://github.com/dana-team/capp-backend) — it never talks to the Kubernetes API directly.

It provides a clean, dark-themed UI for signing in with a username and password, then performing full lifecycle management of `Capp` resources — create, view, edit, and delete — without needing `kubectl` or deep Kubernetes knowledge.

## Features

- **Username / Password Sign-In** — Authenticate against a [Dex](https://dexidp.io/) OIDC provider via the `capp-backend`. Short-lived access tokens are automatically refreshed in the background.
- **Multi-Cluster Support** — The backend exposes multiple clusters; the UI selects a default healthy cluster on login and allows switching from the navigation bar.
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

- **Node.js** 20 LTS or later
- **npm** 9 or later
- A running [`capp-backend`](https://github.com/dana-team/capp-backend) instance (defaults to `http://localhost:8080` in development)

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

In dev mode, all `/api` requests are reverse-proxied to the `capp-backend`. The proxy reads an `X-Backend-Url` header (injected automatically by the API client) to route requests to the correct backend. You can set `VITE_BACKEND_URL` to override the default `http://localhost:8080`.

### Build for production

```bash
npm run build
```

This runs `tsc` for type-checking and then `vite build`. The output is placed in the `dist/` directory. In production, the frontend is served as a static bundle and calls the `capp-backend` URL entered at login directly (no dev proxy).

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
├── api/            # Backend API client and CRUD wrappers (capps, namespaces, clusters)
├── components/     # Shared and feature-specific React components
│   ├── capps/      # Capp form, detail view, section accordions
│   ├── layout/     # AppShell, TopNav (cluster switcher)
│   └── ui/         # Generic UI primitives (Button, Input, Select, …)
├── context/        # NamespaceContext — selected namespace across pages
├── hooks/          # React Query hooks (useCapps, useNamespaces, …)
├── pages/          # Top-level page components
├── store/          # Zustand stores (auth — backend URL, cluster, access/refresh JWTs)
├── types/          # Shared TypeScript types
└── utils/          # cappBuilder and other utilities
```

## Authentication

1. Navigate to `/login`.
2. Enter the `capp-backend` URL (e.g. `http://localhost:8080`), your username, and your password.
3. The frontend exchanges credentials with the backend (`POST /api/v1/auth/login`), which authenticates against Dex and returns a short-lived **access JWT** and a long-lived **refresh JWT**.
4. Both tokens and the selected cluster are persisted in `localStorage` via Zustand.
5. All API calls include the access JWT as a `Bearer` token. On a `401` response, the client automatically calls `POST /api/v1/auth/refresh` and retries the request; if the refresh also fails, the user is redirected to `/login`.
6. All non-login routes are protected and redirect to `/login` when unauthenticated.

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
