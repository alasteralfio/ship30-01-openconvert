// Per-site allow/deny logic. Pure, no I/O — the content script, popup,
// and context menu all decide "does this host convert?" through the same helpers,
// so enforcement is identical everywhere. The two lists persist independently in
// Settings; switching `siteListMode` never touches the other list.

import type { Settings } from './storage';

/**
 * Normalize a host for storage/comparison: lowercase and drop a leading `www.`
 * so an entry like `example.com` covers `www.example.com` too. Trailing dots are
 * trimmed. A bare/empty host returns ''.
 */
export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, '').replace(/^www\./, '');
}

/**
 * Whether `host` is covered by a list `entry`. Matches the entry exactly or as a
 * parent domain of `host` — so `example.com` matches `example.com`, `www.example.com`,
 * and `shop.example.com`, but not `notexample.com`.
 */
export function hostMatches(host: string, entry: string): boolean {
  const h = normalizeHost(host);
  const e = normalizeHost(entry);
  if (e === '') return false;
  return h === e || h.endsWith(`.${e}`);
}

/** The list currently enforced for the active mode. */
export function activeList(settings: Settings): string[] {
  return settings.siteListMode === 'whitelist' ? settings.whitelist : settings.blacklist;
}

/**
 * Whether page-price conversion is allowed on `host` under the site rules alone
 * (the global `enabled` kill switch is applied separately by callers):
 * - blacklist mode → convert unless the host matches a blacklist entry.
 * - whitelist mode → convert only if the host matches a whitelist entry.
 */
export function siteConverts(host: string, settings: Settings): boolean {
  const listed = activeList(settings).some((entry) => hostMatches(host, entry));
  return settings.siteListMode === 'whitelist' ? listed : !listed;
}

/**
 * Return a Settings patch that makes `siteConverts(host)` equal `shouldConvert`
 * under the current mode, editing only the active list:
 * - blacklist mode: convert → remove matching entries; don't → add the host.
 * - whitelist mode: convert → add the host; don't → remove matching entries.
 * Removal drops any entry the host matches (including a broader parent domain),
 * so toggling a subdomain on/off behaves intuitively.
 */
export function setSiteConverts(
  settings: Settings,
  host: string,
  shouldConvert: boolean,
): Partial<Settings> {
  const key = settings.siteListMode === 'whitelist' ? 'whitelist' : 'blacklist';
  const normalized = normalizeHost(host);
  if (normalized === '') return {};
  const current = settings[key];
  // "Add to this list" happens when converting in whitelist mode or NOT converting
  // in blacklist mode; otherwise we remove matching entries.
  const add = settings.siteListMode === 'whitelist' ? shouldConvert : !shouldConvert;
  if (add) {
    if (current.some((e) => normalizeHost(e) === normalized)) return {};
    return { [key]: [...current, normalized] };
  }
  const pruned = current.filter((e) => !hostMatches(host, e));
  return pruned.length === current.length ? {} : { [key]: pruned };
}
