# UI Rework Design

**Date:** 2026-03-14
**Status:** Approved

## Overview

Full UI overhaul of the Capp Console frontend. Replace hand-rolled component library with shadcn/ui, add Magic UI animations, migrate from sidebar layout to top-navbar dashboard layout, and introduce a CSS-variable-based theming system so the entire color scheme can be changed in one file.

## Goals

- Replace all custom `src/components/ui/` components with shadcn/ui equivalents
- Move from sidebar layout (`AppShell`) to a top navbar layout
- Add a stat card summary row (Total Capps, Enabled, Namespaces) to the list page
- Introduce CSS-variable theming so colors are swappable without touching component code
- Add targeted Magic UI animations: NumberTicker, BlurFade, BorderBeam, AnimatedGridPattern

## Non-Goals

- No new features or pages
- No light mode (single dark theme, but architecture supports adding it later)
- No command palette or layout toggles

---

## Theming System

All color tokens are CSS custom properties defined in a single `src/styles/theme.css` file. Tailwind maps all color utilities to these variables via `hsl(var(--token))`. Changing the entire app's color scheme requires editing only this one file.

**Token structure:**

```css
/* src/styles/theme.css */
:root {
  /* Backgrounds */
  --background:        240 10% 4%;   /* #09090f — page background */
  --surface:           240 8%  7%;   /* #111118 — navbar, sidebar, card bg */
  --card:              240 9%  6%;   /* #0d0d14 — input / inset bg */

  /* Borders */
  --border:            240 6% 12%;  /* #1e1e2e */

  /* Text */
  --text:              0 0% 95%;
  --text-secondary:    240 5% 65%;
  --text-muted:        240 4% 35%;

  /* Primary accent (currently violet — swap here to retheme) */
  --primary:           262 83% 55%; /* #7c3aed */
  --primary-foreground:0 0%  100%;
  --primary-subtle:    262 83% 55% / 0.1;

  /* Semantic */
  --success:           142 71% 45%; /* #22c55e */
  --danger:            0   72% 51%; /* #ef4444 */
  --info:              217 91% 60%; /* #3b82f6 */
  --accent:            262 83% 75%; /* #c4b5fd — lighter violet for links */
}
```

`tailwind.config.ts` references these via `hsl(var(--primary))` etc. — the existing token names (`text-text`, `bg-surface`, etc.) are preserved so no component-level class changes are needed beyond the initial migration to shadcn.

---

## Component Migration

All custom components in `src/components/ui/` are replaced with shadcn/ui equivalents. The custom files are deleted.

| Current custom component | Replacement |
|--------------------------|-------------|
| `Button.tsx`             | shadcn `Button` |
| `Input.tsx`              | shadcn `Input` |
| `Select.tsx`             | shadcn `Select` |
| `Badge.tsx`              | shadcn `Badge` |
| `Alert.tsx`              | shadcn `Alert` |
| `Modal.tsx`              | shadcn `Dialog` |
| `ConfirmModal.tsx`       | shadcn `AlertDialog` |
| `Spinner.tsx`            | Lucide `Loader2` icon in a small local wrapper (shadcn has no Spinner component) |
| `Pagination.tsx`         | shadcn `Pagination` |
| `ArrayInput.tsx`         | Keep custom (no shadcn equivalent) |
| `KeyValueList.tsx`       | Keep custom (no shadcn equivalent) |
| `EmptyState.tsx`         | Keep custom |
| `CopyButton.tsx`         | Keep custom |
| `cn.ts`                  | Keep (already correct) |

shadcn/ui is initialized via `npx shadcn init` with the `default` style and the existing dark theme CSS variables wired in.

---

## Layout: AppShell → TopNav

The sidebar (`AppShell`) is replaced by a top navbar component (`src/components/layout/TopNav.tsx`).

**TopNav structure (left → right):**
- Logo (Zap icon + "Capp Console" wordmark)
- Vertical divider
- Nav links (currently just "Capps", active state with `bg-primary/10 border-primary/20 text-primary`)
- Spacer
- Namespace selector (shadcn `Select`, compact)
- Cluster status indicator (animated ping dot + truncated cluster URL)
- Disconnect button

`AppShell.tsx` is replaced by a new `src/components/layout/AppShell.tsx` that renders `<TopNav />` above an `<Outlet />` with a full-height content area.

---

## Capp List Page

**Page structure (top to bottom):**

1. **Page header row** — "Capps" title + resource count subtitle + "Create Capp" button (right-aligned)
2. **Stat cards row** — 3 cards: Total Capps, Enabled, Namespaces
3. **Search bar** — max-width 320px, shadcn `Input` with search icon
4. **shadcn Table** — same columns as current (Name, Namespace, State, Scale Metric, Created, Actions)
5. **Pagination** — shadcn Pagination below table

**Stat cards:**
- Each card: label (uppercase, muted) + large number
- Numbers animate on mount with Magic UI `NumberTicker`
- Bottom accent border: `--primary` for Total, `--success` for Enabled, `--info` for Namespaces
- Colors come from CSS variables, not hardcoded

**Table:**
- shadcn `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- Row hover: left `2px` border in `--primary` color (keep existing interaction)
- Action buttons (Edit, Delete) appear on row hover

**Magic UI animations:**
- Page entry: `BlurFade` wraps the page header, stat cards, and table with `delay` stagger
- Stat numbers: `NumberTicker` component inside each stat card

---

## Login Page

Login card is structurally unchanged. Upgrades:

- Inputs → shadcn `Input`
- Button → shadcn `Button`
- Background: Magic UI `AnimatedGridPattern` (replaces current static CSS grid `backgroundImage`)
  - Grid color driven by `--border` CSS variable
  - Radial fade overlay keeps card readable
  - Subtle `--primary` glow behind the card

---

## Detail Page

Cards layout replacing the flat vertical stack:

**Layout:**
- Page entry: `BlurFade` wraps the header row and each card with a stagger delay
- 2-column grid: "Overview" card (left) + "Container" card (right)
- "Status Conditions" card spans full width below
- Optional cards (NFS Volumes, Kafka Sources) appear below if data present

**Card design:**
- shadcn `Card`, `CardHeader`, `CardContent`
- Top accent line on each card (`--primary`, `--info`, `--success` respectively) — 1px, gradient fade
- Magic UI `BorderBeam` on hover

**Status Conditions:**
- Rendered as mini-cards in a 3-column grid (or fewer if < 3 conditions)
- Color-coded: True = `--success`, False = `--danger`, Unknown = muted

---

## Magic UI Components Used

| Component | Where used |
|-----------|------------|
| `NumberTicker` | Stat card counts on CappListPage |
| `BlurFade` | Page-level entry animation (list + detail) |
| `BorderBeam` | Hover effect on detail page cards |
| `AnimatedGridPattern` | Login page background |

All Magic UI components are installed via the MCP server (`npx shadcn add <url>`).

---

## File Changes Summary

**New files:**
- `src/styles/theme.css` — all CSS variable token definitions
- `src/components/layout/TopNav.tsx` — top navbar (replaces sidebar in AppShell)

**Modified files:**
- `src/components/layout/AppShell.tsx` — use TopNav, remove sidebar
- `src/index.css` — import `theme.css`, remove inline color definitions
- `tailwind.config.ts` — map all color tokens to CSS variables
- All pages + components — swap custom UI components for shadcn equivalents

**Deleted files:**
- `src/components/ui/Button.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Select.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/Alert.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/ConfirmModal.tsx`
- `src/components/ui/Spinner.tsx`
- `src/components/ui/Pagination.tsx`
