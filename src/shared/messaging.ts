// Typed message contract between popup, content script, and worker. Popup and
// content send requests; the worker responds. See overview.md > Architecture.

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
