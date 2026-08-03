// Popup root: the quick converter UI (Checkpoint 3.1). Reads/writes settings via
// browser.storage (helpers in shared/storage) and asks the worker for the cached
// rate table via typed messages — no direct network here. Every pair converts
// locally off the one cached USD-anchored table. Functional/near-unstyled; the
// visual design lands in the Phase 6 sweep.

import { useEffect, useMemo, useState } from 'react';
import { LuArrowRightLeft, LuCopy, LuRefreshCw } from 'react-icons/lu';
import browser from 'webextension-polyfill';
import { sendMessage, sendToContent } from '../shared/messaging';
import { convert } from '../shared/convert';
import { getSettings, setSettings as persistSettings } from '../shared/storage';
import type { RateCache, Settings } from '../shared/storage';
import CurrencyCombobox from './CurrencyCombobox';
import FromFilter from './FromFilter';

/**
 * Source auto-detect: ask the active tab's content script for its dominant
 * currency and adopt it as the source — but only while the source has never been
 * set manually (overview.md > Core A). Returns the code to adopt, or null.
 */
async function detectPageSource(current: Settings): Promise<string | null> {
  if (current.sourceManuallySet) return null;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return null;
  const report = await sendToContent(tab.id, { type: 'getDominantCurrency' }).catch(() => undefined);
  const dominant = report?.dominant ?? null;
  return dominant && dominant !== current.source ? dominant : null;
}

/** Compact "updated Xh ago" label from a ms-epoch timestamp. */
function timeAgo(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function App() {
  const [rates, setRates] = useState<RateCache | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [amount, setAmount] = useState('1');
  const [status, setStatus] = useState<'loading' | 'ready' | 'no-rates'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      const [cache, loaded] = await Promise.all([sendMessage({ type: 'getRates' }), getSettings()]);
      // Adopt the page's dominant currency as the source unless it's locked.
      const detected = await detectPageSource(loaded);
      const effective = detected ? { ...loaded, source: detected } : loaded;
      if (detected) await persistSettings({ source: detected });
      setSettings(effective);
      setRates(cache);
      setStatus(cache ? 'ready' : 'no-rates');
    })();
  }, []);

  /** Merge a patch into local state and persist it. */
  async function update(patch: Partial<Settings>): Promise<void> {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    await persistSettings(patch);
  }

  const codes = useMemo(() => (rates ? Object.keys(rates.rates).sort() : []), [rates]);

  const amountNum = Number(amount);
  const result = useMemo(() => {
    if (!rates || !settings || amount.trim() === '' || !Number.isFinite(amountNum)) return null;
    try {
      return convert(amountNum, settings.source, settings.target, rates.rates);
    } catch {
      return null;
    }
  }, [rates, settings, amount, amountNum]);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    try {
      const cache = await sendMessage({ type: 'refreshRates' });
      setRates(cache);
      setStatus(cache ? 'ready' : 'no-rates');
    } finally {
      setRefreshing(false);
    }
  }

  /** Clear the lock and immediately re-adopt the page's dominant currency. */
  async function resetSourceToAuto(): Promise<void> {
    if (!settings) return;
    const detected = await detectPageSource({ ...settings, sourceManuallySet: false });
    await update({ sourceManuallySet: false, ...(detected ? { source: detected } : {}) });
  }

  async function copyResult(): Promise<void> {
    if (result === null) return;
    await navigator.clipboard.writeText(String(result));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  if (status === 'loading' || !settings) {
    return <main className="popup">Loading…</main>;
  }

  if (status === 'no-rates' || !rates) {
    return (
      <main className="popup">
        <p>No exchange rates yet — check your connection.</p>
        <button type="button" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Retry'}
        </button>
      </main>
    );
  }

  return (
    <main className="popup">
      <label className="oc-kill-switch">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={() => void update({ enabled: !settings.enabled })}
        />
        Auto-convert prices on pages
      </label>

      <label>
        Amount
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      <CurrencyCombobox
        label="From"
        value={settings.source}
        codes={codes}
        // A manual source change permanently locks out per-page auto-detect.
        onChange={(code) => void update({ source: code, sourceManuallySet: true })}
      />

      <button
        type="button"
        aria-label="Swap source and target"
        onClick={() =>
          void update({
            source: settings.target,
            target: settings.source,
            sourceManuallySet: true,
          })
        }
      >
        <LuArrowRightLeft /> Swap
      </button>

      <CurrencyCombobox
        label="To"
        value={settings.target}
        codes={codes}
        onChange={(code) => void update({ target: code })}
      />

      <FromFilter
        value={settings.fromFilter}
        codes={codes}
        onChange={(list) => void update({ fromFilter: list })}
      />

      <div className="oc-result">
        {result === null ? (
          <span>—</span>
        ) : (
          <span>
            {amountNum} {settings.source} = {result} {settings.target}
          </span>
        )}
        <button
          type="button"
          aria-label="Copy converted value"
          onClick={() => void copyResult()}
          disabled={result === null}
        >
          <LuCopy /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="oc-status">
        <span>Rates updated {timeAgo(rates.updatedAt)}</span>
        <button
          type="button"
          aria-label="Refresh rates"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          <LuRefreshCw /> {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {settings.sourceManuallySet && (
        <button type="button" onClick={() => void resetSourceToAuto()}>
          Reset source to auto-detect
        </button>
      )}
    </main>
  );
}
