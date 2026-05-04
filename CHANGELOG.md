# Changelog

## [0.6.0] — 2026-05-04

### New Features

- **Reports panel** — new section in the sidebar (above Sync Status) at `/customers/[slug]/reports`. A freeform report builder where you choose an entity, select columns, apply endpoint/snapshot filters, and navigate data by repeating time windows.
- **Time window navigator** — the centrepiece of the Reports panel. Define a window type (Weekly Sun–Sun, Weekly Mon–Mon, Monthly, or Custom N days), then step backward and forward through valid windows with prev/next arrows. The active window date range is displayed prominently. "Next" is disabled when the next window would exceed today.
- **Saved report configs** — name and save a report's column selections, filters, and window type. Saved reports appear in the left panel and can be re-opened to instantly re-run with any window.
- **In-app data preview** — a live preview table refreshes as you change entity, columns, filters, or window, showing up to 100 rows with a total row count.
- **Export XLS / CSV** — export the full filtered dataset (up to 50,000 rows) for the active window as XLS or CSV using the existing xlsx/papaparse packages.
- **Copy Email Summary** — copies a formatted HTML table of the first 10 preview rows plus key metadata to the clipboard, ready to paste into an email.
- **Sidebar visual separation** — a subtle divider line separates the analytics items (Dashboard, Transcripts, Reports) from the admin items (Sync Status). Admin items are rendered at reduced opacity when inactive, making the primary navigation items visually dominant.

---

## [0.5.0] — 2026-05-04

### New Features

- **DateRangePicker** — new shared date filter component used across the dashboard and transcript list. Provides one-click presets (Today, 7 days, 30 days, 3 months) plus manual from/to date inputs. Active preset is highlighted and the button label reflects the selected range. Defaults to the last 7 days on first load.
- **Session volume redesign** — dashboard session volume chart converted from a bar chart to a smooth filled area chart with custom white-border data points, matching the Cognigy Insights visual style.
- **Unique Users per Day chart** — new area chart on the dashboard showing distinct users by day, displayed alongside session volume in a two-column grid.
- **Dashboard filter parity with Transcripts** — dashboard now supports multi-select endpoint filter, multi-select snapshot filter, and the shared `DateRangePicker`. All charts and KPIs re-query when any filter changes.
- **Transcript list date filter** — bare date inputs in the transcript list replaced with the shared `DateRangePicker`, defaulting to last 7 days on first visit.

---

## [0.4.0] — 2026-05-01

### New Features

- **Transcript Explorer** — new "Transcripts" section in the sidebar sub-nav for each customer. Shows a paginated session list with session ID, user ID, endpoint, message count, and relative start time. Escalated sessions are highlighted with an orange phone icon.
- **Session transcript view** — clicking a session opens a full chat transcript with styled message bubbles: user messages right-aligned (primary colour), bot messages left-aligned (muted), and live agent handover messages in orange. Messages are grouped with timestamps shown when there is a 5-minute gap between turns.
- **Session details panel** — alongside the transcript, a sidebar shows session metadata: session ID (with copy button), start time, endpoint, message count, step count, escalation count, snapshot name, and user rating with comment if present.
- **User history panel** — if the session's `userId` is known, a "User History" section lists up to 20 other sessions from the same user, each linking directly to that transcript.
- Filter and search on the transcript list: search by session ID or user ID, filter by date range and endpoint, with live debounced search.

---

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
