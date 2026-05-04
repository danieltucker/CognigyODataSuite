# Changelog

## [0.3.0] — 2026-05-04

### New Features

- **Agent Evaluation section** — dashboard surfaces simulator test criteria (pass/fail results) embedded in `analytics.inputData`. Shows overall pass rate KPI, test run count, criteria count, and a per-criterion progress bar breakdown. Colour-coded by pass rate (green ≥90%, amber ≥75%, red <75%). Only visible when simulator run data exists.
- **Top Flows chart** — horizontal bar chart showing the most-executed flows from `executed_steps`, filtered by date and endpoint. Only visible when executed steps data exists.
- **LLM error alert banner** — detects LLM provider errors (Bad Request, prompt errors) in `conversations.inputData` debug logs and surfaces a warning banner with error count and percentage of conversation turns affected. Only shown when errors exist.
- **Avg conversations per session** — "Conversations" KPI card now shows conversations-per-session as a subtitle (e.g. "3.1 per session").

### Improvements

- Rename "Records" → "Sync Status" in sidebar sub-nav.
- Bump version to 0.3.0.

---

## [0.2.0] — 2026-05-01

### New Features

- **Goals dashboard section** — New KPI card showing total goal events, plus "Top Goals" bar chart and "Goal Events by Day" area chart. Goals section is conditionally shown only when goal data exists.
- **Endpoint filter on dashboard** — Dropdown to filter all dashboard charts and KPIs by endpoint name, alongside the existing channel filter.
- **Column filters in data explorer** — Channel, Endpoint Name, and Snapshot Name filter dropdowns appear in the toolbar when the active entity has those columns. Filters stack with search and date range.
- **Clickable records** — Clicking any row in the data explorer opens a full-detail side panel showing every field and its formatted value.
- **Version display** — `v0.2.0` shown in the sidebar footer.

### Improvements

- **"Records" label** — Sidebar sub-nav link renamed from "Entities" to "Records".
- **Back button** — Breadcrumb "← Overview" replaced with a `Back` button that uses `router.back()`, preserving the navigation history rather than hardcoding a destination.
- **Breadcrumb styling** — Redesigned with a `ChevronLeft` icon, subtle separator, and cleaner typography.
- **Future dates blocked** — Date range pickers in the dashboard and data explorer now have `max={today}` set, preventing selection of future dates.

### Bug Fixes

- **DuckDB lock race condition** — Connection cache now stores a `Promise<DuckDBConnection>` immediately on first call, preventing concurrent `DuckDBInstance.create()` calls on the same file. Added 5-attempt retry with backoff for stale-process lock conflicts.
- **Dropdown backgrounds transparent** — `popover` color token was missing from `tailwind.config.ts`, causing all Select menus and Sheet components to render with no background. Added `popover` and `popover-foreground` to the Tailwind colors map.
- **OData sync HTTP 500 at cursor boundary** — Incremental import now treats a 500 response when a cursor is active as end-of-data (rather than throwing). Fixes spurious sync failures when the timestamp filter matches no remaining records.
- **Charts black on dark background** — Replaced all Tremor chart components with pure Recharts, giving full control over axis, grid, and fill colours. Theme-aware colours via `useTheme()`.

---

## [0.1.0] — Initial Release

- Next.js 15 App Router project scaffold
- Per-customer DuckDB database (one `.duckdb` file per customer)
- OData incremental and full-refresh import engine with timestamp-cursor pagination
- Customer management (add, edit, delete, test connection)
- Data explorer with pagination, sorting, search, date range, column visibility, CSV/Excel export
- Analytics dashboard with session volume, top intents, channel distribution, execution time, NLU confidence
- Light / Dark / Auto theme toggle
- `node-cron` scheduled sync per customer
