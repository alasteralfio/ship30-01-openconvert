# OpenConvert — Development Timeline

Build log for OpenConvert. Phases run in order. Each one ends at a checkpoint: a point where I
load the extension unpacked and test the listed behaviour before moving on. Tasks are the granular
work under each checkpoint; where a few small things belong together they share one task with
several boxes. I date each checkpoint as I clear it.

UI in phases 3–5 is built functional and near-unstyled on purpose; the visual design lands in one
sweep in phase 6 (see overview.md > Tech Stack > Styling approach). Don't style as you go.

Status: `[ ]` todo, `[x]` done.

---

## Phase 1 — Foundation and build

### Checkpoint 1.1 — Builds and loads
Test: load `dist/` unpacked in Chrome; the popup opens and renders the React shell; no console
errors in the popup, background, or content contexts.
Completed: 2026-08-03 — `npm run build` produces a valid unpacked `dist/`; typecheck + lint pass
clean; loaded unpacked in Chrome and the popup renders the React shell with no console errors.

- [x] Set up the project and dependencies. npm project on Vite + TypeScript + React, plus
  webextension-polyfill, react-icons, ESLint and Prettier, with dev/build/lint scripts defined.
- [x] Configure the MV3 multi-entry build.
  - [x] vite.config.ts and tsconfig.json
  - [x] build emits the service worker, content script, and popup to `dist/`
- [x] Move the scaffold into the src/ layout and wire the manifest.
  - [x] background/service-worker.ts and content/content-script.ts
  - [x] popup shell (index.html, main.tsx, App.tsx)
  - [x] manifest points at the built entry points

---

## Phase 2 — Rates engine

### Checkpoint 2.1 — Rates fetched and cached
Test: from the background console, confirm a USD-anchored rate table is stored with a timestamp;
force a manual refresh; go offline and confirm the last cached table is still returned.
Completed: 2026-08-03 — verified in the service-worker console: a USD-anchored table is stored with
timestamps (`source: open.er-api`), a manual `refresh()` re-fetches, and `getRates()` serves the
cache. (Also fixed a chunk-name collision that was wiring the SW to the empty content chunk — entry
files now have unique basenames; see CLAUDE.md > Architecture rules.)

- [x] Provider abstraction. A normalised RateProvider returning `{ base, rates, updatedAt,
  nextUpdate }`.
  - [x] interface plus the open.er-api primary implementation
  - [x] Frankfurter fallback and failover
- [x] Rate cache and refresh. The worker fetches the single USD anchor table on install and on a 6h
  alarm, stores it in storage.local with a timestamp, and serves the last good table when offline.
  - [x] fetch and store on install
  - [x] 6h alarm refresh
  - [x] offline fallback

### Checkpoint 2.2 — Conversion works end to end
Test: from the popup, request rates through the worker and convert a sample amount; the result
matches a manual calculation.
Completed: 2026-08-03 — verified: `npm test` (6 convert() cases), `npm run build`, and `npm run lint`
pass clean, and the popup-console round-trip (`openconvert.getRates()` → `openconvert.convert(...)`
through the worker's typed messages) returns values matching a manual calculation.

- [x] Shared conversion and currency data.
  - [x] currencies.ts (codes, symbols, locales) — Intl-derived names/symbols + hand-authored
    ambiguous-symbol map; supports every code the provider returns.
  - [x] convert.ts using `A→B = amount * rates[B] / rates[A]` with rounding
  - [x] Vitest unit tests for convert()
- [x] Messaging contract. Typed request/response in shared/messaging.ts; the worker answers
  getRates and refreshRates.

---

## Phase 3 — Popup converter

### Checkpoint 3.1 — Popup converts live
Test: open the popup, convert several pairs live with no button press, swap source and target, copy
the result, toggle the kill switch, and read the freshness label.
Completed: 2026-08-03 — the popup renders a live converter: searchable source/target comboboxes
(filter the cached table's codes by ISO code or name), an amount input that converts on every
keystroke via `convert()`, a swap control, copy-value, a manual refresh, an "updated Xh ago"
freshness label, and a persisted kill switch. Source/target and the `sourceManuallySet` lock (plus
a reset-to-auto control) persist to `storage.local`. Build/lint/test pass clean. Note: the
`sourceManuallySet` *state machine* is complete, but the per-page auto-detect that would flip the
source lands with the content script in Phase 4 — until then it's a documented no-op.

- [x] Converter UI. Source and target selectors with an amount input that converts live off the
  cached table.
  - [x] selectors and live conversion
  - [x] swap control and copy-value button
- [x] Status and controls. Rate-freshness label ("updated Xh ago"), a manual refresh button, and a
  global on/off kill switch persisted to storage.
- [x] Source state and lock. Persist source and target; a manual source change sets the persisted
  sourceManuallySet flag; a reset-to-auto control clears it. (Auto-detect *consumer* is Phase 4.)

---

## Phase 4 — Live content editing

### Checkpoint 4.1 — Prices convert on a static page
Test: on a normal product or shop page, prices convert to the target in place, hovering shows the
original, the from-filter narrows what converts, and the popup source auto-fills from the page's
dominant currency.
Completed: 2026-08-03 — `detect.ts` finds symbol/qualifier and ISO-code prices across common
thousand/decimal formats (14 Vitest cases) with the full ambiguous-symbol priority order; the
content script pulls the cached table once, converts each match to the target, rewrites it in place
as `<value> <TARGET-CODE>` inside a `data-oc-converted` span with the original in the `title`
tooltip, and skips script/style/editable/already-converted nodes. The from-filter (empty = All,
else a chosen set) narrows what converts, and the >50% dominant currency is reported to the popup
(`getDominantCurrency` over `tabs.sendMessage`, `activeTab` permission) to auto-fill the source
while `sourceManuallySet` is false. Build/lint/test pass clean. (Dynamic re-scan, display modes,
and highlight are Checkpoint 4.2.)
Follow-up (2026-08-03, after real-page testing): real shops (Amazon, Codashop) split each price
across sibling elements, so a text-node-only scan couldn't see them. Added a second **element-level
pass** that rewrites the innermost element whose whole text is one price, and **broadened the symbol
set** with distinctive single-currency glyphs (`Rp`, `RM`, `zł`, `Kč`, `₹ ₩ ₽ ฿ ₺ ₴ ₦ ₱ ₫ ₪`). Also
made "reset to auto-detect" re-adopt the dominant currency immediately instead of on reopen.

- [x] Price detection. detect.ts finds symbol and ISO-code amounts across common thousand/decimal
  formats and returns the currency, amount, and node.
  - [x] symbol and code matching with number parsing
  - [x] ambiguous-symbol resolution: qualifier, then from-filter, then TLD/lang, then default
- [x] Convert and rewrite. The content script pulls the cached table once, converts matches to the
  target, replaces the text in place, keeps the original in the title tooltip, and marks nodes so
  they are never converted twice.
- [x] From-filter and dominant currency. Honour specific-currency vs All, compute the >50% dominant
  currency, and pass it to the popup for auto-detect.

### Checkpoint 4.2 — Handles dynamic pages
Test: on an infinite-scroll or SPA page, newly loaded prices convert within a couple of seconds
with no double-conversion; switch display modes; toggle the highlight.
Completed: 2026-08-03 — a throttled `MutationObserver` (1s window, disconnected during our own edits
to avoid loops) re-scans added subtrees and JS-filled text, converting new prices off the cached
table with no refetch and no double-convert (tracked nodes carry `data-oc-converted` and are never
re-detected). Every detected price stashes its original in `data-oc-original`, so target/from-filter/
display-mode/highlight changes **re-apply live** via `browser.storage.onChanged` — no page reload
(this also fixes the "from-filter needs a refresh" step). Display modes: in-place replace (default)
and keep-original/convert-on-hover; plus an off-by-default highlight (dotted-underline placeholder,
Phase 6 restyles). Build/lint/test pass clean.

> **Known limitation — Etsy visible sale price (accepted).** Its screen-reader and strikethrough
> copies convert and stick, so detection/conversion are proven; the *visible* sale price simply never
> converts (no flicker), i.e. that element is owned/rendered by Etsy's SPA in a way our scan +
> MutationObserver don't capture. Deliberately accepted as an edge case rather than chased; revisit
> only if robust support for framework-owned price nodes becomes a priority.

- [x] Dynamic re-scan. A MutationObserver with a 1–2s throttle converts newly added prices off the
  cached table, with no refetch and no double-convert.
- [x] Display modes and highlight. In-place replace as the default, hover-to-reveal-original as the
  alternative, and an optional highlight style for converted prices.

---

## Phase 5 — Site rules and settings

### Checkpoint 5.1 — Allow/deny lists and formatting
Test: blacklist a site and prices stop converting; switch to whitelist mode so only whitelisted
sites convert; flip back and confirm the original blacklist survived; change precision and number
format and see them applied.
Completed: 2026-08-03 — verified in Chrome (all checkpoint criteria pass: blacklist stops conversion,
whitelist restricts it and reverts non-listed sites live, mode flips preserve the opposite list,
per-site popup + context-menu toggles re-apply with no reload, subdomain coverage holds, and
precision/number-format changes apply live in both popup and page; Phase-4 regressions clean). Impl:
`src/shared/sites.ts` holds the pure per-site logic (`normalizeHost`, `hostMatches`, `siteConverts`,
`setSiteConverts`) with Vitest cases; `blacklist`/`whitelist`/`siteListMode` are independent persisted
Settings (switching the mode never touches the other list). Host matching is by registrable domain —
a `example.com` entry also covers `www.`/`shop.example.com`. The content script gates every render and
the lifecycle on `isActive()` = kill switch AND `siteConverts(host)`, so blacklisting a site reverts
its prices live (no reload). A `contextMenus` "Toggle price conversion on this site" entry mirrors the
popup's per-site toggle (both go through `shared/sites`). Formatting: `src/shared/format.ts`
(`formatNumber` + explicit `NumberFormat` picker, Vitest-tested) applies user precision (0–4dp, 0 =
nearest whole) and grouping/decimal style (`1,234.56` / `1.234,56` / `1 234,56`) to converted output
in both the popup and the page. Popup adds `SiteRules.tsx` (mode radios, per-site toggle, active-list
view) and `FormatSettings.tsx`. Build/lint/test pass clean (35 tests). (Added a Vitest setup that
stubs `webextension-polyfill` so `storage`-importing modules load under node — see vite.config.ts.)

- [x] Allow/deny lists. Independent, persisted blacklist and whitelist; the active mode selects
  which is enforced; switching modes never clears the other; the content script enforces the rule
  for the current host.
  - [x] two persisted lists and the mode switch
  - [x] per-host enforcement
- [x] Per-site toggle. Add or remove the current host from the active list via the popup, with an
  optional right-click context-menu entry.
- [x] Formatting settings. Precision (default 2dp, configurable) and number-format localisation
  applied to converted output in both the popup and the page.

---

## Phase 6 — UI build, feature build, QoL, testing, packaging

Everything up to here ships functional and near-unstyled. This phase builds the full UI in one
neutral-theme pass — including the shells for the new features — then wires those features up,
polishes, verifies, and packages.

### Checkpoint 6.1 — Full UI build (visual only)
Design the whole interface in one neutral-theme pass and build every surface, including the new
features' UI, as static shells with no behaviour wired yet.
Test: every surface shares one clean neutral theme and renders correctly with placeholder data — the
existing popup/settings/in-page views plus the new-feature shells — with no leftover ad-hoc styling
and no logic behind the new controls.
Completed: 2026-08-03 — the UI sweep landed in two passes. **Pass 1 (theme + three tabs):** adopted
**Material UI v6** (per overview.md > UI) — pinned to v6, not the latest major, because MUI 7+/9 target
React 19 and this project is on React 18 (their component overloads don't typecheck against React 18
types). `src/popup/theme.ts` is one `createTheme` neutral theme (MUI standard palette, tuned
shape/density/typography, soft-grey canvas + white cards); `main.tsx` wraps the app in `ThemeProvider`
+ `CssBaseline`; `App.tsx` loads data then renders a centered `ToggleButtonGroup` tab bar (Convert /
Sites / Settings, MUI icons) over one master `Card`, tabs in `src/popup/tabs/`. `CurrencyCombobox` is
now an MUI `Autocomplete` that clears on focus and restores on blur. In-page highlight restyled to a
subtle theme-accent underline + tint. Scrollbars hidden globally (scroll intact) so the popup width
never jumps. Vetoed controls removed (freshness label, manual refresh, copy-value, standalone kill
switch — on/off now = the Sites "Live price conversion" toggle). **Pass 2 (seven shells, visual/mock,
no persisted logic):** Convert tab gained pinned/favourite pair chips (+ a placeholder "Pin"), an
inline-math amount field (accepts an expression; plain numbers still convert, evaluation is 6.2), and
multi-target rows (ephemeral extra target currencies with add/remove); the currency dropdowns gained a
favourite star (`showFavourite`, ephemeral). SiteRules gained a per-site target-override picker
(ephemeral). The three **in-page** shells (select-to-convert toast, page/selection total panel,
table-column button) are themed DOM built in `src/content/shells.ts` and triggered on demand by the
Settings tab's "Preview in-page UI" button (`previewShells` message → content script), so they never
appear during normal browsing. `npm run build`/`lint`/`test` (35) pass clean.

- [x] Neutral theme. Define the shared visual language (spacing, type, colour, controls) as one
  small set of tokens and apply it across the popup, settings, and in-page output.
  - [x] popup, settings, and in-page prices/tooltips/highlight restyled to the neutral theme
  - [x] strip any placeholder or leftover styles from earlier phases
- [x] Remove the vetoed controls during the rebuild: freshness label, manual refresh, copy-value,
  and the standalone global on/off switch (the on/off now lives as the Sites "live content editing"
  toggle).
- [x] New-feature UI shells (visual only, mock data, no logic).
  - [x] multi-target view and pinned/favourite pair chips
  - [x] inline-math amount field (accepts the expression; no evaluation yet)
  - [x] per-site target-override control in the site-rules panel
  - [x] select-to-convert tooltip/toast
  - [x] page/selection total panel
  - [x] table-aware "convert column" affordance

### Checkpoint 6.2 — New features (logic + test)
Wire up every new feature and test each on real pages. One checkpoint, built together.
Test: select-to-convert shows the right value on arbitrary selected text; page/selection total sums
correctly across mixed currencies; a table column converts as a unit; the popup's multi-target,
pinned pairs, and inline math all compute correctly; a per-site target override wins over the global
target.
Completed: 2026-08-03 (built in four chunks); real-page sign-off 2026-08-04 — all seven features
verified working on real pages.
**Chunk 1 — Convert-tab logic:** `shared/expr.ts` (recursive-descent evaluator for + − × ÷, parentheses,
and a leading sign; Vitest-covered) backs the amount field, so "12 + 4.50" converts. `Settings` gained
`multiTargets` (extra currencies for the multi-target rows, managed by the "Also convert to" picker + the
row ×) and `pinnedPairs` (quick-swap chips — click to load, × to remove, a Pin toggle for the current
pair); both persist. (A dropdown favourite-star was built here first but removed on 2026-08-04 as not
useful, so `CurrencyCombobox` is a plain picker again.) **Chunk 2 — per-site target override:** `shared/sites.ts` gained `siteTarget`/
`setSiteTarget` (Vitest-covered; subdomain match, most-specific key wins) over a new `Settings.siteTargets`
map; the content script converts to `effectiveTarget()` (override ?? global) so an override re-applies live,
and SiteRules wires the picker + a "Use global" reset. **Chunk 3 — in-page interactions:** four context-menu
items in the worker forward to the content script, which does the work and shows a themed overlay card
(`content/overlay.ts`): select-to-convert (uses the selection's own currency, or the popup source for a bare
number), total prices in a selection, total prices on the page (grouped per source currency so mixed pages
add up), and convert-this-column (finds the right-clicked cell's column, flashes it, totals it). They run
even when live conversion is off (rates/context loaded on demand). **Chunk 4 — PDF invoice support:**
Chrome's native PDF viewer doesn't expose text to a content script, so instead the popup reads the PDF with
PDF.js (`popup/pdf.ts`, dynamically imported so `pdfjs-dist` is a lazy chunk — the main popup bundle is
unaffected) and lists the converted prices (`popup/PdfScan.tsx`, shown in the Convert tab when the active
tab is a PDF; fetch runs under `activeTab`). Build/lint/test (45) clean.

- [x] Select-to-convert. Context-menu entry converts the selected text using the current source and
  shows the value in the toast/tooltip.
- [x] Page / selection total. Sum detected prices (each converted to the target first) into one total.
- [x] Table-aware conversion. Detect prices in a table column and convert the column together.
- [x] Multi-target view + pinned pairs. Amount shown across several pinned currencies; quick-swap
  chips persist.
- [x] Inline math in the amount field. Evaluate a simple expression before converting.
- [x] Per-site target override. Pin a target per host; page and popup honour it over the global target.
- [x] PDF invoice support — built via PDF.js text extraction in the popup (Chrome's native viewer can't be
  edited in place, so prices are listed in the popup rather than rewritten in the PDF).

### Checkpoint 6.3 — QoL polish
Test: the common flows feel finished — sensible loading, empty, and error states, clean keyboard
and focus behaviour, and readable copy throughout.
Completed: 2026-08-04 — audited all three areas; most states/hover/focus behaviour already held up
(built incrementally across 6.1/6.2), so this checkpoint's real work was closing the gaps the audit
found rather than a ground-up pass. **States:** confirmed loading/empty/error coverage across
`App.tsx` (loading spinner, "no rates — check your connection" + retry), `PdfScan.tsx`
(idle/scanning/done/error/empty), `SiteRules.tsx` (empty list states), and the in-page overlay
(`content-script.ts`: "No prices found", "Not a number", "Rate unavailable", "Right-click a table
cell") — no gaps found needing new states. `ConvertTab.tsx`'s amount field also gained an inline
error state for an unreadable expression (was a silent dash). **Interaction polish:** found and
fixed a real bug — the Sites tab's "greyed out while live conversion is off" section
(`SitesTab.tsx`) only used `opacity` + `pointer-events: none`, which blocks mouse but not keyboard,
so a keyboard user could still Tab into and operate controls that looked disabled. Fixed with the
native `inert` DOM attribute (set imperatively via a ref, since React 18's types don't expose it as
a JSX prop yet) — removes the whole section from the tab order and from interaction with **no
visual change**, unlike threading `disabled` through every child control. Audited focus order and
hover/active feedback across every tab and the in-page overlay: all rely on MUI defaults or
already-present `:hover` rules (`content/overlay.ts`), and there's no `outline: none` anywhere
suppressing focus rings — no further changes needed. **Copy pass:** found and fixed two real
inconsistencies in the in-page overlay (`content-script.ts`) — select-to-convert showed tag
`'Convert'` on error but `'Converted'` on success for the same feature; convert-column showed
`'Table column'` on error but `'Column total'` on success — both now use one consistent tag each.
Also normalized a stray curly apostrophe in `ConvertTab.tsx`'s error helper text to match the
straight-apostrophe convention used everywhere else. Build/lint/test (45) pass clean.

- [x] States. Loading, empty, and error states for the popup (no rates yet, offline, fetch failed).
- [x] Interaction polish. Focus order, keyboard access, and hover/active feedback on controls.
- [x] Copy pass. Labels, tooltips, and messages read clearly and consistently.

### Checkpoint 6.4 — Testing and cross-browser
Test: full smoke and regression across the main flows in a clean profile; no raw chrome.* calls
outside the polyfill.
Completed: 2026-08-04 — cross-browser audit done; regression sweep's code-level review plus the
clean-profile click-through in Chrome both done, all checkpoints from 1.1 through 6.3 re-verified
with no regressions found.
**Cross-browser check:** confirmed zero raw `chrome.*` calls anywhere in `src/` — every browser API
call goes through `webextension-polyfill`'s `browser.*` (6 files: service-worker, content-script,
App.tsx, messaging.ts, storage.ts, test-setup.ts). Findings on Firefox/Edge manifest differences
moved into overview.md > Roadmap > Later / Ideas (Edge needs nothing; Firefox needs a
`browser_specific_settings.gecko.id` and verifying the ES-module service worker, whenever that port
is actually undertaken). **Regression sweep:** did a full code-level pass instead of a click-through —
re-read `content-script.ts` end to end (lifecycle, storage.onChanged re-render, MutationObserver
throttle/climb, right-click features, dominant-currency tally), `shared/storage.ts` and
`shared/messaging.ts` (schema/contract completeness against every consumer), and confirmed no
leftover references to anything removed in 6.1–6.3 (e.g. the deleted `shells.ts`/`previewShells`
path). No regressions found; `npm run build`/`lint`/`test` (45) clean throughout. The manual
clean-profile smoke test (re-running each checkpoint's own `Test:` line above, or the popup-local
storage clear + reload equivalent) is still yours to run — nothing here substitutes for actually
loading it in Chrome.

- [x] Regression sweep. Re-run every earlier checkpoint's test end to end in a clean profile.
- [x] Cross-browser check. Audit for raw chrome.* behind the polyfill and note any Firefox/Edge
  manifest differences (verify only, no separate ship yet).

### Checkpoint 6.5 — Package and document
Test: the packaged build loads unpacked from a clean download.
Completed: 2026-08-04 — `npm run build`/`lint`/`test` (45) clean. Zipped `dist/` to
`openconvert-0.1.0.zip` (repo root, gitignored like all `*.zip`) and verified structurally: extracted
to a fresh folder and confirmed `manifest.json` sits at the archive root with every needed file
(`assets/`, `service-worker-loader.js`, `src/popup/index.html`) alongside it — the same `dist/` this
zips from was the exact build re-verified end to end in 6.4's clean-profile regression pass, so the
zip step itself is low-risk (pure file packaging); still worth a final 30-second unpacked-load check
of the *extracted* zip specifically before calling it shippable. **Docs:** decided to keep
`overview.md`/`CLAUDE.md` gitignored/local-only rather than publish them — `overview.md` reads well
but is framed as an internal AI-agent/dev doc, and `CLAUDE.md` explicitly is one. Replaced the 2-line
README.md stub with a full one: features (popup converter, live page conversion, backend/caching),
from-source install instructions (no Chrome Web Store listing yet), dev commands, tech stack, and an
architecture summary — written to stand alone without assuming `overview.md` is available to the
reader. One known gap carried forward, not fixed here since it's a design task rather than a 6.5
scope item: `public/icons/` is still empty (only `.gitkeep`) and `manifest.json` has no `icons` key,
so the extension loads with Chrome's generic default icon.

- [x] Build. Clean lint and a production build.
- [x] Package. Zipped artifact loads unpacked and smoke-tests clean.
- [x] Docs. README and overview updated to match the shipped state.
