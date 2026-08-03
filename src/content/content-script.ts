// Content script: scan the DOM for prices, request the cached rate table from the
// worker once, convert locally, rewrite matches in place (original kept in the
// title tooltip), and report the page's dominant currency for the popup's source
// auto-detect. Checkpoint 4.1 is a one-shot scan of the static page; the throttled
// MutationObserver for dynamic pages lands in 4.2. See overview.md > Core B.

import browser from 'webextension-polyfill';
import { sendMessage } from '../shared/messaging';
import type { ContentRequest, DominantCurrencyReport } from '../shared/messaging';
import { getSettings } from '../shared/storage';
import type { RateCache, Settings } from '../shared/storage';
import { convert } from '../shared/convert';
import { detectPrices } from './detect';
import type { DetectionContext, PriceMatch } from './detect';

/** Marks a rewritten node so re-scans never convert it twice. */
const CONVERTED_ATTR = 'data-oc-converted';

/** Running count of every detected source currency on this page (for auto-detect). */
const pageTally: Record<string, number> = {};

/** Elements whose text is code/markup or user-editable — never scan these. */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);

function shouldSkip(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest(`[${CONVERTED_ATTR}]`)) return true; // already converted
  if (parent.isContentEditable) return true;
  return SKIP_TAGS.has(parent.tagName);
}

/** Whether a detected source currency is in scope for conversion (empty filter = All). */
function passesFilter(currency: string, fromFilter: string[]): boolean {
  return fromFilter.length === 0 || fromFilter.includes(currency);
}

/** Rewrite one text node's prices in place, wrapping each converted value in a span. */
function convertTextNode(node: Text, ctx: DetectionContext, rates: RateCache, settings: Settings) {
  const text = node.nodeValue;
  if (!text) return;
  const matches = detectPrices(text, ctx);
  if (matches.length === 0) return;

  // Tally every detected currency (dominant-currency stat is independent of the
  // from-filter — it describes the page, not what we chose to convert).
  for (const m of matches) pageTally[m.currency] = (pageTally[m.currency] ?? 0) + 1;

  const fragment = document.createDocumentFragment();
  let cursor = 0;
  let converted = 0;
  for (const m of matches) {
    if (!passesFilter(m.currency, settings.fromFilter)) continue;
    if (m.currency === settings.target) continue; // already the target currency
    const value = safeConvert(m, settings.target, rates);
    if (value === null) continue;

    fragment.appendChild(document.createTextNode(text.slice(cursor, m.start)));
    const span = document.createElement('span');
    span.setAttribute(CONVERTED_ATTR, '');
    span.title = m.text; // original price, revealed on hover
    span.textContent = `${value.toFixed(2)} ${settings.target}`;
    fragment.appendChild(span);
    cursor = m.end;
    converted += 1;
  }

  if (converted === 0) return; // everything was filtered out — leave the node untouched
  fragment.appendChild(document.createTextNode(text.slice(cursor)));
  node.parentNode?.replaceChild(fragment, node);
}

function safeConvert(m: PriceMatch, target: string, rates: RateCache): number | null {
  try {
    return convert(m.amount, m.currency, target, rates.rates);
  } catch {
    return null; // currency missing from the cached table
  }
}

/** Walk every text node under `root` and convert the prices found. */
function scanTextNodes(root: Node, ctx: DetectionContext, rates: RateCache, settings: Settings) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  // Collect first, then mutate — rewriting nodes mid-walk would invalidate the walker.
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n as Text;
    if (!shouldSkip(text)) nodes.push(text);
  }
  for (const node of nodes) convertTextNode(node, ctx, rates, settings);
}

/** Max characters an element's combined text may hold to still count as one price. */
const MAX_PRICE_LEN = 40;

/**
 * A single price occupying (essentially) an element's whole text — e.g. a shop's
 * price split across `<span>S$</span><span>12</span><span>34</span>`, where no one
 * text node holds the full price. Returns that match, or null.
 */
function fullPriceMatch(el: Element, ctx: DetectionContext): PriceMatch | null {
  const raw = el.textContent ?? '';
  if (raw.length === 0 || raw.length > MAX_PRICE_LEN) return null;
  const trimmed = raw.trim();
  const matches = detectPrices(trimmed, ctx);
  if (matches.length === 1 && matches[0].start === 0 && matches[0].end === trimmed.length) {
    return matches[0];
  }
  return null;
}

/** Replace a whole element's content with the converted value (original in `title`). */
function convertElement(el: Element, m: PriceMatch, rates: RateCache, settings: Settings) {
  pageTally[m.currency] = (pageTally[m.currency] ?? 0) + 1;
  if (!passesFilter(m.currency, settings.fromFilter)) return;
  if (m.currency === settings.target) return;
  const value = safeConvert(m, settings.target, rates);
  if (value === null) return;
  el.setAttribute(CONVERTED_ATTR, '');
  (el as HTMLElement).title = m.text;
  el.textContent = `${value.toFixed(2)} ${settings.target}`;
}

/**
 * Catch prices split across child elements: find the *innermost* elements whose
 * whole text is one price and rewrite them. Runs after the text-node pass, so
 * single-node prices are already wrapped (and skipped here via CONVERTED_ATTR).
 */
function scanSplitPrices(root: Element, ctx: DetectionContext, rates: RateCache, settings: Settings) {
  const candidates: { el: Element; m: PriceMatch }[] = [];
  for (const el of root.querySelectorAll('*')) {
    if (el.closest(`[${CONVERTED_ATTR}]`)) continue;
    if (SKIP_TAGS.has(el.tagName) || (el as HTMLElement).isContentEditable) continue;
    const m = fullPriceMatch(el, ctx);
    if (m) candidates.push({ el, m });
  }
  // Keep only the innermost matches (drop any element that contains another match),
  // so we rewrite `<span>S$12.34</span>` rather than an outer wrapper.
  const innermost = candidates.filter(
    ({ el }) => !candidates.some((o) => o.el !== el && el.contains(o.el)),
  );
  for (const { el, m } of innermost) convertElement(el, m, rates, settings);
}

/** Convert prices on the page: single-node prices first, then split ones. */
function scan(root: Element, ctx: DetectionContext, rates: RateCache, settings: Settings) {
  scanTextNodes(root, ctx, rates, settings);
  scanSplitPrices(root, ctx, rates, settings);
}

/** The ISO code making up >50% of detected prices, or null. */
function dominantCurrency(): string | null {
  const total = Object.values(pageTally).reduce((sum, n) => sum + n, 0);
  if (total === 0) return null;
  for (const [code, count] of Object.entries(pageTally)) {
    if (count / total > 0.5) return code;
  }
  return null;
}

// Answer the popup's dominant-currency query (delivered via tabs.sendMessage).
browser.runtime.onMessage.addListener((message: unknown): Promise<DominantCurrencyReport> | undefined => {
  if ((message as ContentRequest | undefined)?.type !== 'getDominantCurrency') return undefined;
  return Promise.resolve({ dominant: dominantCurrency(), tally: { ...pageTally } });
});

async function init() {
  const settings = await getSettings();
  if (!settings.enabled) return; // global kill switch — do not touch the page
  const rates = await sendMessage({ type: 'getRates' });
  if (!rates) return; // no cached table yet; nothing to convert against

  const ctx: DetectionContext = {
    knownCodes: new Set(Object.keys(rates.rates)),
    host: location.hostname,
    lang: document.documentElement.lang || '',
    fromFilter: settings.fromFilter,
  };
  scan(document.body, ctx, rates, settings);
}

void init();
