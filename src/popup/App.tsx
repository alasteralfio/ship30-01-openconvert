// Popup root: loads the cached rate table (by message) and user settings (via
// shared/storage), then renders the tabbed shell — Convert / Sites / Settings. All
// conversion is local off the one cached USD-anchored table; no network here.

import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import PublicIcon from '@mui/icons-material/Public';
import TuneIcon from '@mui/icons-material/Tune';
import browser from 'webextension-polyfill';
import { sendMessage, sendToContent } from '../shared/messaging';
import { getSettings, setSettings as persistSettings } from '../shared/storage';
import type { RateCache, Settings } from '../shared/storage';
import ConvertTab from './tabs/ConvertTab';
import SitesTab from './tabs/SitesTab';
import SettingsTab from './tabs/SettingsTab';

type TabId = 'convert' | 'sites' | 'settings';

/**
 * Ask the active tab's content script for its dominant currency and adopt it as the
 * source — but only while the source has never been set by hand. Returns the code to
 * adopt, or null.
 */
async function detectPageSource(current: Settings): Promise<string | null> {
  if (current.sourceManuallySet) return null;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return null;
  const report = await sendToContent(tab.id, { type: 'getDominantCurrency' }).catch(() => undefined);
  const dominant = report && 'dominant' in report ? report.dominant : null;
  return dominant && dominant !== current.source ? dominant : null;
}

/** Active tab's hostname, or null for a non-web page (chrome://, new tab, …). */
async function activeTabHost(): Promise<string | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  try {
    const { protocol, hostname } = new URL(tab.url);
    return protocol === 'http:' || protocol === 'https:' ? hostname : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [rates, setRates] = useState<RateCache | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'no-rates'>('loading');
  const [host, setHost] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('convert');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    void (async () => {
      const [cache, loaded, tabHost] = await Promise.all([
        sendMessage({ type: 'getRates' }),
        getSettings(),
        activeTabHost(),
      ]);
      // Adopt the page's dominant currency as the source unless it's locked.
      const detected = await detectPageSource(loaded);
      const effective = detected ? { ...loaded, source: detected } : loaded;
      if (detected) await persistSettings({ source: detected });
      setSettings(effective);
      setRates(cache);
      setHost(tabHost);
      setStatus(cache ? 'ready' : 'no-rates');
    })();
  }, []);

  /** Merge a patch into local state and persist it. */
  async function update(patch: Partial<Settings>): Promise<void> {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    await persistSettings(patch);
  }

  /** Clear the source lock and immediately re-adopt the page's dominant currency. */
  async function resetSourceToAuto(): Promise<void> {
    if (!settings) return;
    const detected = await detectPageSource({ ...settings, sourceManuallySet: false });
    await update({ sourceManuallySet: false, ...(detected ? { source: detected } : {}) });
  }

  async function retry(): Promise<void> {
    setRetrying(true);
    try {
      const cache = await sendMessage({ type: 'refreshRates' });
      setRates(cache);
      setStatus(cache ? 'ready' : 'no-rates');
    } finally {
      setRetrying(false);
    }
  }

  const codes = useMemo(() => (rates ? Object.keys(rates.rates).sort() : []), [rates]);

  return (
    <Box sx={{ width: 360, bgcolor: 'background.default', p: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
        <ToggleButtonGroup
          value={tab}
          exclusive
          size="small"
          color="primary"
          onChange={(_, next: TabId | null) => next && setTab(next)}
          aria-label="Popup section"
        >
          <ToggleButton value="convert" aria-label="Convert">
            <SwapHorizIcon fontSize="small" sx={{ mr: 0.5 }} />
            Convert
          </ToggleButton>
          <ToggleButton value="sites" aria-label="Sites">
            <PublicIcon fontSize="small" sx={{ mr: 0.5 }} />
            Sites
          </ToggleButton>
          <ToggleButton value="settings" aria-label="Settings">
            <TuneIcon fontSize="small" sx={{ mr: 0.5 }} />
            Settings
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Card sx={{ p: 1.5 }}>
        {status === 'loading' || !settings ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
            <CircularProgress size={22} />
            <Typography variant="body2" color="text.secondary">
              Loading rates…
            </Typography>
          </Stack>
        ) : status === 'no-rates' || !rates ? (
          <Stack spacing={1.5} sx={{ py: 2 }}>
            <Typography variant="body2">
              No exchange rates yet — check your connection.
            </Typography>
            <Button variant="contained" onClick={() => void retry()} disabled={retrying}>
              {retrying ? 'Retrying…' : 'Retry'}
            </Button>
          </Stack>
        ) : tab === 'convert' ? (
          <ConvertTab
            rates={rates}
            settings={settings}
            codes={codes}
            update={update}
            resetSourceToAuto={resetSourceToAuto}
          />
        ) : tab === 'sites' ? (
          <SitesTab settings={settings} host={host} codes={codes} update={update} />
        ) : (
          <SettingsTab settings={settings} update={update} />
        )}
      </Card>
    </Box>
  );
}
