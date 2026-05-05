# Changelog

## [0.7.0] — 2026-05-04

### New Features

- **Configurable dashboard** — each customer's dashboard layout is now fully customisable and persisted per customer at `data/customers/{slug}/dashboard-config.json`. Changes are saved automatically.
- **Drag-and-drop card reordering** — in Edit mode (click the Settings icon in the dashboard header), cards can be reordered by dragging. KPI cards and chart cards each have their own sortable grid. Uses `@dnd-kit`.
- **Add / remove cards** — in Edit mode, a remove button appears on each card (hover to reveal). Hidden cards appear in a restore panel at the bottom of each section. Click any hidden card to add it back.
- **New KPI cards** — three new KPI cards are available alongside the existing five:
  - **Containment Rate** — percentage of sessions handled without escalation
  - **Unique Users** — distinct users in the filtered period
  - **Avg Session Length** — mean session duration computed from analytics timestamps
  - **Goal Completion Rate** — percentage of sessions that completed at least one goal (hidden by default, add via Edit mode)
- **New chart cards** — two new charts available in the card registry:
  - **Escalation Trend** — daily escalation rate as a line chart, showing whether escalations are rising or falling over the period
  - **Top Executed Steps** — top step labels from the executed steps data, showing which bot nodes fire most often (hidden by default)
- **GET/PUT dashboard config API** — new endpoints at `/api/customers/[slug]/dashboard-config` for reading and writing layout configs. All card IDs are validated against the registry; unknown IDs are silently dropped.

---

## [0.6.3] — 2026-05-04

### UI Improvements

- **Transcript toggle clarity** — replaced the confusing "Has messages" / "Show empty" toggle with a consistent "With messages" filter chip that shows a checkmark when active and dims when inactive. The label never changes, so the current state is always unambiguous.
- **Transcript session rows** — session rows now display both endpoint name and snapshot name as small muted chips (with Globe and BookOpen icons to distinguish them), alongside the user ID. User ID takes all remaining space and truncates rightward only when needed — no artificial width cap. Session ID shows last 28 characters for better identification. Badges (Escalated, rating) are always visible.
- **Transcript detail — mobile tab navigation** — on mobile the transcript detail now shows a "Conversation / Details" tab bar. Conversation tab shows the full chat in natural document flow (no collapsed height). Details tab shows Session Details, Contact Profile, and Session History. Desktop view is unchanged.
- **Filter dropdown width** — endpoint and snapshot dropdowns now expand to a minimum of 280 px wide so long names aren't cut off. Option text wraps rather than truncating, so the full name is always readable when the dropdown is open.

---

## [0.6.2] — 2026-05-04

### Security Hardening

- **Slug path traversal defence** — `getCustomer()` now rejects any slug that doesn't match `^[a-z0-9-]+$` before performing a registry lookup, ensuring malformed slugs never reach filesystem path construction.
- **HTTPS enforcement** — the create and update customer API routes now reject `odataUrl` values that don't start with `https://`, preventing accidental plaintext credential transmission.
- **Deployment warning in README** — added an explicit warning that this tool is localhost-only and should not be run on shared machines or behind a proxy without adding authentication.
- **Reports SQL safety comment** — annotated the report preview and export routes to clarify that safety of interpolated table/column names depends entirely on the ALLOWED whitelist, and that all new keys must be `[a-z0-9_]` only.

---

## [0.6.1] — 2026-05-04

### Bug Fixes & Improvements

- **Initial sync limit** — incremental entities (Analytics, Conversations, Sessions, etc.) now cap their first-ever sync to the past N days (default 365) instead of fetching all historical data unbounded. Configurable per customer via the new "Historical data limit (days)" field in Add/Edit Customer. A manual full refresh (`Sync All` with full flag) still bypasses the limit.
- **Reports column names corrected** — the column whitelist in the Reports preview and export endpoints was misaligned with the actual DuckDB schema (`userId` → `contactId` in Analytics, `text` → `inputText` in Conversations, `nodeId` → `stepLabel` in Executed Steps). Column picker in the UI updated to match.
- **Reports infinite refetch fixed** — replaced `useCallback` + `useEffect` with a single `useEffect` + `AbortController`. Array dependencies are now stable string keys, preventing re-fetches on every render.
- **Tailwind `require` error fixed** — `tailwind.config.ts` was using `require('tailwindcss-animate')` which fails in Node 22 ESM mode. Replaced with a top-level `import`.

---

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
