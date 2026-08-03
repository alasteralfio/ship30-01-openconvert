// Scans the page for prices, converts them against the worker's cached rate table,
// and rewrites them in place. Each tracked price keeps its original text in
// data-oc-original, so changing the target, from-filter, or display mode re-renders
// live (via storage.onChanged) with no reload. A throttled MutationObserver handles
// dynamic pages, and we report the page's dominant currency so the popup can
// auto-pick the source.

import browser from 'webextension-polyfill';
import { sendMessage } from '../shared/messaging';
import type { ContentRequest, DominantCurrencyReport } from '../shared/messaging';
import { getSettings, DEFAULT_SETTINGS } from '../shared/storage';
import type { RateCache, Settings } from '../shared/storage';
import { convert } from '../shared/convert';
import { formatNumber } from '../shared/format';
import { siteConverts } from '../shared/sites';
import { detectPrices } from './detect';
import type { DetectionContext, PriceMatch } from './detect';

const CONVERTED_ATTR = 'data-oc-converted'; // marks a tracked price (never re-detected)
const HIGHLIGHT_ATTR = 'data-oc-highlight'; // present when the highlight toggle is on
const RESCAN_MS = 1000; // throttle window for the dynamic-page re-scan
const MAX_PRICE_LEN = 40; // longest element text still treated as a single price

/** Elements whose text is code/markup or user-editable — never scan these. */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);

// --- Session state (set on start; rates never change within a page session) -----
let rates: RateCache | null = null;
let settings: Settings = DEFAULT_SETTINGS;
let ctx: DetectionContext = { knownCodes: new Set(), host: '', lang: '', fromFilter: [] };
let scanned = false;

/** Running count of every detected source currency on this page (for auto-detect). */
const pageTally: Record<string, number> = {};

// --- Skipping & filtering -------------------------------------------------------

function shouldSkipText(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest(`[${CONVERTED_ATTR}]`)) return true; // already tracked
  if (parent.isContentEditable) return true;
  return SKIP_TAGS.has(parent.tagName);
}

/** Whether a detected source currency is in scope for conversion (empty filter = All). */
function passesFilter(currency: string): boolean {
  return settings.fromFilter.length === 0 || settings.fromFilter.includes(currency);
}

/**
 * Whether conversion should run here right now: the global kill switch AND the
 * per-site allow/deny rule for this host. Checked in the render path (so blacklisting
 * reverts live) as well as the lifecycle gates.
 */
function isActive(): boolean {
  return settings.enabled && siteConverts(location.hostname, settings);
}

// --- Rendering (single source of truth for how a tracked price looks) -----------

/**
 * Render one tracked element from its stashed original price, honouring the
 * current settings. Called on first conversion and on every settings change, so
 * flipping target/from-filter/display-mode/highlight is fully reversible.
 */
function applyRender(el: HTMLElement): void {
  const original = el.dataset.ocOriginal;
  if (original === undefined) return;
  const m = detectPrices(original, ctx)[0];
  const value =
    m && isActive() && passesFilter(m.currency) && m.currency !== settings.target
      ? safeConvert(m, settings.target)
      : null;

  if (value === null) {
    el.textContent = original; // show the original untouched
    el.removeAttribute('title');
    el.removeAttribute(HIGHLIGHT_ATTR);
    return;
  }

  const converted = `${formatNumber(value, settings.numberFormat, settings.precision)} ${settings.target}`;
  if (settings.displayMode === 'hover') {
    el.textContent = original; // original stays visible
    el.title = converted; // converted revealed on hover
  } else {
    el.textContent = converted; // converted replaces the price
    el.title = original; // original revealed on hover
  }
  el.toggleAttribute(HIGHLIGHT_ATTR, settings.highlight);
}

function safeConvert(m: PriceMatch, target: string): number | null {
  if (!rates) return null;
  try {
    return convert(m.amount, m.currency, target, rates.rates, settings.precision);
  } catch {
    return null; // currency missing from the cached table
  }
}

/** Wrap a detected price (from a text node) in a tracked span. */
function makeTrackedSpan(original: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.setAttribute(CONVERTED_ATTR, '');
  // Stay visually transparent: inherit the price's own colour, so a site rule that
  // styles nested spans (e.g. Codashop) can't recolour the converted value.
  span.style.color = 'inherit';
  span.dataset.ocOriginal = original;
  applyRender(span);
  return span;
}

// --- Detection passes -----------------------------------------------------------

/** Rewrite one text node's prices, wrapping each in a tracked span. */
function convertTextNode(node: Text): void {
  const text = node.nodeValue;
  if (!text) return;
  const matches = detectPrices(text, ctx);
  if (matches.length === 0) return;
  for (const m of matches) pageTally[m.currency] = (pageTally[m.currency] ?? 0) + 1;

  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const m of matches) {
    fragment.appendChild(document.createTextNode(text.slice(cursor, m.start)));
    fragment.appendChild(makeTrackedSpan(m.text));
    cursor = m.end;
  }
  fragment.appendChild(document.createTextNode(text.slice(cursor)));
  node.parentNode?.replaceChild(fragment, node);
}

/** Walk every text node under `root` and convert the prices found. */
function scanTextNodes(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  // Collect first, then mutate — rewriting nodes mid-walk would invalidate the walker.
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n as Text;
    if (!shouldSkipText(text)) nodes.push(text);
  }
  for (const node of nodes) convertTextNode(node);
}

/**
 * A single price occupying (essentially) an element's whole text — e.g. a shop's
 * price split across `<span>S$</span><span>12</span><span>34</span>`, where no one
 * text node holds the full price. Returns that match, or null.
 */
function fullPriceMatch(el: Element): PriceMatch | null {
  const raw = el.textContent ?? '';
  if (raw.length === 0 || raw.length > MAX_PRICE_LEN) return null;
  const trimmed = raw.trim();
  const matches = detectPrices(trimmed, ctx);
  if (matches.length === 1 && matches[0].start === 0 && matches[0].end === trimmed.length) {
    return matches[0];
  }
  return null;
}

/**
 * Catch prices split across child elements: track the *innermost* elements whose
 * whole text is one price. Runs after the text-node pass, so single-node prices
 * are already wrapped (and skipped here via CONVERTED_ATTR).
 */
function scanSplitPrices(root: Element): void {
  const candidates: { el: Element; m: PriceMatch }[] = [];
  for (const el of root.querySelectorAll('*')) {
    if (el.closest(`[${CONVERTED_ATTR}]`)) continue;
    // Skip a container whose text is derived from an already-converted child —
    // otherwise its converted "<value> <CODE>" text reads as a fresh price and
    // gets re-processed (double conversion / lost styling).
    if (el.querySelector(`[${CONVERTED_ATTR}]`)) continue;
    if (SKIP_TAGS.has(el.tagName) || (el as HTMLElement).isContentEditable) continue;
    const m = fullPriceMatch(el);
    if (m) candidates.push({ el, m });
  }
  // Keep only the innermost matches so we rewrite `<span>S$12.34</span>`, not a wrapper.
  const innermost = candidates.filter(
    ({ el }) => !candidates.some((o) => o.el !== el && el.contains(o.el)),
  );
  for (const { el, m } of innermost) {
    pageTally[m.currency] = (pageTally[m.currency] ?? 0) + 1;
    const target = el as HTMLElement;
    target.setAttribute(CONVERTED_ATTR, '');
    target.dataset.ocOriginal = m.text;
    applyRender(target);
  }
}

/** Convert prices under `root`: single-node prices first, then split ones. */
function scan(root: Element): void {
  scanTextNodes(root);
  scanSplitPrices(root);
}

/** How many ancestors up a mutation to re-scan (a split price is assembled by a
 * parent from sibling children, so scanning only the changed node misses it). */
const CLIMB_LEVELS = 3;

/** Scan from a few ancestors above a changed node so sibling-assembled prices show. */
function scanFrom(el: Element): void {
  let root: Element = el;
  for (let i = 0; i < CLIMB_LEVELS; i++) {
    const parent = root.parentElement;
    if (!parent || parent === document.body) break;
    root = parent;
  }
  scan(root);
}

/** Re-render every already-tracked price from its stashed original. */
function reapplyAll(): void {
  for (const el of document.querySelectorAll<HTMLElement>(`[${CONVERTED_ATTR}]`)) {
    applyRender(el);
  }
}

// --- Dynamic-page re-scan (throttled MutationObserver) --------------------------

const pendingRoots = new Set<Element>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

const observer = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) pendingRoots.add(node as Element);
      else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
        pendingRoots.add(node.parentElement);
      }
    }
    // Text swapped in place (e.g. a price value filled by JS after load).
    if (record.type === 'characterData' && record.target.parentElement) {
      pendingRoots.add(record.target.parentElement);
    }
  }
  if (pendingRoots.size > 0 && flushTimer === undefined) {
    flushTimer = setTimeout(flush, RESCAN_MS);
  }
});

function observe(): void {
  observer.observe(document.body, { childList: true, characterData: true, subtree: true });
}

/** Scan everything accumulated since the last flush. Our own edits are excluded
 * by disconnecting the observer for the duration. */
function flush(): void {
  flushTimer = undefined;
  const roots = [...pendingRoots];
  pendingRoots.clear();
  // The page may have been disabled (kill switch / blacklist) since this batch was
  // queued; if so, drop it rather than mutate a page we shouldn't be touching.
  if (!isActive()) return;
  observer.disconnect();
  for (const root of roots) {
    if (!root.isConnected || root.closest(`[${CONVERTED_ATTR}]`)) continue;
    scanFrom(root);
  }
  observe();
}

// --- Dominant currency (popup source auto-detect) -------------------------------

function dominantCurrency(): string | null {
  const total = Object.values(pageTally).reduce((sum, n) => sum + n, 0);
  if (total === 0) return null;
  for (const [code, count] of Object.entries(pageTally)) {
    if (count / total > 0.5) return code;
  }
  return null;
}

browser.runtime.onMessage.addListener(
  (message: unknown): Promise<DominantCurrencyReport> | undefined => {
    if ((message as ContentRequest | undefined)?.type !== 'getDominantCurrency') return undefined;
    return Promise.resolve({ dominant: dominantCurrency(), tally: { ...pageTally } });
  },
);

// --- Highlight style (placeholder look) -----------------------------------------

function injectHighlightStyle(): void {
  if (document.getElementById('oc-style')) return;
  const style = document.createElement('style');
  style.id = 'oc-style';
  style.textContent = `[${HIGHLIGHT_ATTR}]{text-decoration:underline dotted;text-underline-offset:2px;}`;
  (document.head ?? document.documentElement).appendChild(style);
}

// --- Lifecycle ------------------------------------------------------------------

/** First full scan of the page and start watching for dynamic changes. */
async function start(): Promise<void> {
  if (scanned) return;
  rates = await sendMessage({ type: 'getRates' });
  if (!rates) return; // no cached table yet; nothing to convert against
  ctx = {
    knownCodes: new Set(Object.keys(rates.rates)),
    host: location.hostname,
    lang: document.documentElement.lang || '',
    fromFilter: settings.fromFilter,
  };
  injectHighlightStyle();
  scan(document.body);
  scanned = true;
  observe();
}

// Re-apply live when settings change (target, from-filter, display mode, highlight,
// kill switch, site rules, precision, number format). Becoming active from cold
// (kill switch on, or this host newly allowed) triggers the first scan.
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return;
  const wasActive = isActive();
  settings = { ...DEFAULT_SETTINGS, ...(changes.settings.newValue as Partial<Settings>) };
  ctx.fromFilter = settings.fromFilter;
  const nowActive = isActive();
  if (nowActive && !scanned) {
    void start();
    return;
  }
  if (!wasActive && nowActive && scanned) {
    observer.disconnect();
    scan(document.body); // catch prices that appeared while inactive
    reapplyAll();
    observe();
    return;
  }
  observer.disconnect();
  reapplyAll(); // revert to originals if now inactive, otherwise re-render with the new settings
  if (nowActive) observe(); // stop watching a page we're no longer converting
});

async function init(): Promise<void> {
  settings = await getSettings();
  if (isActive()) await start();
}

void init();
