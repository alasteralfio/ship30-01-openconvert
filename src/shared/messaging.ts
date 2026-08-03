// Typed message contract between the popup, content script, and worker. The popup
// and content script send requests; the worker responds.

import browser from 'webextension-polyfill';
import type { RateCache } from './storage';

/** Requests any context can send to the service worker. */
export type Request = { type: 'getRates' } | { type: 'refreshRates' };

/**
 * Worker response. Both current requests answer with the cached table (or null
 * when none is available). As more request types are added, promote this to a
 * mapped type keyed on Request['type'].
 */
export type Response = RateCache | null;

/** Send a typed request to the worker and await its typed response. */
export function sendMessage(request: Request): Promise<Response> {
  return browser.runtime.sendMessage(request) as Promise<Response>;
}

// --- Popup → content-script channel (a different transport: tabs.sendMessage) ---
// Lets the popup read the active page's detected-currency stats for source
// auto-detect. The content script answers these.

/** Requests the popup sends to a tab's content script. */
export type ContentRequest =
  | { type: 'getDominantCurrency' }
  // Show the in-page UI preview (the mock toast/total/column cards) on the page.
  | { type: 'previewShells' };

/** The content script's per-page currency stats. */
export interface DominantCurrencyReport {
  /** ISO code making up >50% of detected prices, else null. */
  dominant: string | null;
  /** ISO code → count of prices detected on the page. */
  tally: Record<string, number>;
}

export type ContentResponse = DominantCurrencyReport | { ok: true };

/**
 * Send a typed request to a tab's content script. Resolves `undefined` if no
 * content script is listening (e.g. a chrome:// page or a tab not yet scanned).
 */
export function sendToContent(
  tabId: number,
  request: ContentRequest,
): Promise<ContentResponse | undefined> {
  return browser.tabs.sendMessage(tabId, request) as Promise<ContentResponse | undefined>;
}
