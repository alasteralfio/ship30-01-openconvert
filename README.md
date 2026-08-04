# OpenConvert

Open-source **Manifest V3** Chrome extension that converts currencies — a quick popup converter,
plus the headline feature: it scans any web page and rewrites the prices it finds into your target
currency, live, right where they sit. Everything runs client-side; there's no backend, no accounts,
no tracking.

## Features

**Popup converter**
- Live source → target conversion as you type, with a swap button and pinned quick-swap pairs
- Multi-target view — see one amount converted into several currencies at once
- Inline math in the amount field (`12 + 4.50`) for tallying items by hand
- Auto-detects the page's dominant currency as the source (until you set one manually)
- Reads prices out of PDF invoices open in the active tab (via PDF.js) and lists them converted

**Live page conversion**
- Detects currency symbols, qualifiers (`US$`, `CA$`, …), and ISO codes, with locale-aware
  disambiguation for shared symbols like `$` and `¥`
- Rewrites matched prices in place — original kept on hover — and keeps up with dynamic/SPA pages
  via a throttled `MutationObserver`
- Right-click a selection or page to convert it, total it, or total an entire table column
- Per-site allow/deny lists (blacklist or whitelist mode) and a per-site target-currency override
- A from-currency filter to restrict which source currencies get converted
- Configurable decimal precision and number formatting (`1,234.56` / `1.234,56` / `1 234,56`)

**Backend**
- One USD-anchored rate table fetched and cached locally (`open.er-api.com`, with a Frankfurter
  fallback), refreshed on a schedule — every individual conversion is done with local math, never a
  per-price network call. Falls back to the last cached table when offline.

## Installing (from source)

OpenConvert isn't published to the Chrome Web Store yet — load it unpacked:

```bash
git clone https://github.com/alasteralfio/ship30-01-openconvert.git
cd ship30-01-openconvert
npm install
npm run build
```

Then in Chrome: go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and
select the generated `dist/` folder.

## Development

```bash
npm run dev      # watch build with HMR (Vite + @crxjs)
npm run build    # typecheck + production build to dist/
npm run lint     # ESLint
npm run format   # Prettier
npm test         # Vitest unit tests (npm run test:watch for watch mode)
```

Reload the unpacked extension in `chrome://extensions` after each build to pick up changes.

## Tech stack

TypeScript throughout. The popup is React 18 + Material UI 6; the content script and service worker
are plain TypeScript with no framework. Built with Vite + `@crxjs/vite-plugin`. Uses
`webextension-polyfill` (`browser.*`) instead of raw `chrome.*`, so a Firefox/Edge port is mostly a
manifest change away. Tested with Vitest.

## Architecture

Three cooperating parts, plus shared pure logic:

- **Service worker** — the only network caller. Fetches and caches the rate table, runs the
  scheduled refresh, and answers `getRates`/`refreshRates` requests.
- **Content script** — scans the page, converts locally against the cached table, rewrites matched
  prices in place, and re-scans dynamic content.
- **Popup** (React) — the quick converter and all settings, reading/writing `browser.storage` and
  messaging the worker only for rates.

```
src/
├─ background/service-worker.ts   # rate fetching, caching, alarms, messaging
├─ content/                       # price detection, conversion, page rewriting, right-click features
├─ popup/                         # React + MUI converter UI and settings
└─ shared/                        # conversion math, currency data, storage schema, messaging contract
```

## License

MIT — see [LICENSE](LICENSE).
