# OpenConvert — Development Timeline

Build log for OpenConvert. Phases run in order. Each one ends at a checkpoint: a point where I
load the extension unpacked and test the listed behaviour before moving on. Tasks are the granular
work under each checkpoint; where a few small things belong together they share one task with
several boxes. I date each checkpoint as I clear it.

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
  - [x] background/index.ts and content/index.ts
  - [x] popup shell (index.html, main.tsx, App.tsx)
  - [x] manifest points at the built entry points

---

## Phase 2 — Rates engine

### Checkpoint 2.1 — Rates fetched and cached
Test: from the background console, confirm a USD-anchored rate table is stored with a timestamp;
force a manual refresh; go offline and confirm the last cached table is still returned.
Completed:

- [ ] Provider abstraction. A normalised RateProvider returning `{ base, rates, updatedAt,
  nextUpdate }`.
  - [ ] interface plus the open.er-api primary implementation
  - [ ] Frankfurter fallback and failover
- [ ] Rate cache and refresh. The worker fetches the single USD anchor table on install and on a 6h
  alarm, stores it in storage.local with a timestamp, and serves the last good table when offline.
  - [ ] fetch and store on install
  - [ ] 6h alarm refresh
  - [ ] offline fallback

### Checkpoint 2.2 — Conversion works end to end
Test: from the popup, request rates through the worker and convert a sample amount; the result
matches a manual calculation.
Completed:

- [ ] Shared conversion and currency data.
  - [ ] currencies.ts (codes, symbols, locales)
  - [ ] convert.ts using `A→B = rates[B] / rates[A]` with rounding
  - [ ] Vitest unit tests for convert()
- [ ] Messaging contract. Typed request/response in shared/messaging.ts; the worker answers
  getRates and refreshRates.

---

## Phase 3 — Popup converter

### Checkpoint 3.1 — Popup converts live
Test: open the popup, convert several pairs live with no button press, swap source and target, copy
the result, toggle the kill switch, and read the freshness label.
Completed:

- [ ] Converter UI. Source and target selectors with an amount input that converts live off the
  cached table.
  - [ ] selectors and live conversion
  - [ ] swap control and copy-value button
- [ ] Status and controls. Rate-freshness label ("updated Xh ago"), a manual refresh button, and a
  global on/off kill switch persisted to storage.
- [ ] Source state and lock. Persist source and target; a manual source change sets the persisted
  sourceManuallySet flag; a reset-to-auto control clears it.

---

## Phase 4 — Live content editing

### Checkpoint 4.1 — Prices convert on a static page
Test: on a normal product or shop page, prices convert to the target in place, hovering shows the
original, the from-filter narrows what converts, and the popup source auto-fills from the page's
dominant currency.
Completed:

- [ ] Price detection. detect.ts finds symbol and ISO-code amounts across common thousand/decimal
  formats and returns the currency, amount, and node.
  - [ ] symbol and code matching with number parsing
  - [ ] ambiguous-symbol resolution: qualifier, then from-filter, then TLD/lang, then default
- [ ] Convert and rewrite. The content script pulls the cached table once, converts matches to the
  target, replaces the text in place, keeps the original in the title tooltip, and marks nodes so
  they are never converted twice.
- [ ] From-filter and dominant currency. Honour specific-currency vs All, compute the >50% dominant
  currency, and pass it to the popup for auto-detect.

### Checkpoint 4.2 — Handles dynamic pages
Test: on an infinite-scroll or SPA page, newly loaded prices convert within a couple of seconds
with no double-conversion; switch display modes; toggle the highlight.
Completed:

- [ ] Dynamic re-scan. A MutationObserver with a 1–2s throttle converts newly added prices off the
  cached table, with no refetch and no double-convert.
- [ ] Display modes and highlight. In-place replace as the default, hover-to-reveal-original as the
  alternative, and an optional highlight style for converted prices.

---

## Phase 5 — Site rules and settings

### Checkpoint 5.1 — Allow/deny lists and formatting
Test: blacklist a site and prices stop converting; switch to whitelist mode so only whitelisted
sites convert; flip back and confirm the original blacklist survived; change precision and number
format and see them applied.
Completed:

- [ ] Allow/deny lists. Independent, persisted blacklist and whitelist; the active mode selects
  which is enforced; switching modes never clears the other; the content script enforces the rule
  for the current host.
  - [ ] two persisted lists and the mode switch
  - [ ] per-host enforcement
- [ ] Per-site toggle. Add or remove the current host from the active list via the popup, with an
  optional right-click context-menu entry.
- [ ] Formatting settings. Precision (default 2dp, configurable) and number-format localisation
  applied to converted output in both the popup and the page.

---

## Phase 6 — QoL, cross-browser, packaging

### Checkpoint 6.1 — Polish and ship
Test: full smoke test of the main flows in a clean profile; dark mode toggles cleanly; the packaged
build loads unpacked.
Completed:

- [ ] Dark mode. The popup follows prefers-color-scheme with a manual override toggle.
- [ ] Cross-browser pass. Audit for raw chrome.* calls behind the polyfill and note any
  Firefox/Edge manifest differences (verify only, no separate ship yet).
- [ ] Package and document.
  - [ ] clean lint and production build
  - [ ] load-unpacked smoke test in a clean profile
  - [ ] README and overview updated
