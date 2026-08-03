// Per-site allow/deny controls. The active mode selects which list is enforced; the
// two lists persist independently, so switching modes never clears the other. The
// toggle and list edits all go through shared/sites so the popup, content script, and
// context menu stay in agreement.

import type { Settings } from '../shared/storage';
import { activeList, normalizeHost, siteConverts, setSiteConverts } from '../shared/sites';

interface Props {
  settings: Settings;
  /** Active tab's hostname, or null on a non-web page (chrome://, new tab, …). */
  host: string | null;
  onChange: (patch: Partial<Settings>) => void;
}

export default function SiteRules({ settings, host, onChange }: Props) {
  const list = activeList(settings);
  const converts = host ? siteConverts(host, settings) : null;

  return (
    <fieldset className="oc-site-rules">
      <legend>Site rules</legend>

      <label className="oc-inline">
        <input
          type="radio"
          name="siteListMode"
          checked={settings.siteListMode === 'blacklist'}
          onChange={() => onChange({ siteListMode: 'blacklist' })}
        />
        Blacklist (convert everywhere except listed sites)
      </label>
      <label className="oc-inline">
        <input
          type="radio"
          name="siteListMode"
          checked={settings.siteListMode === 'whitelist'}
          onChange={() => onChange({ siteListMode: 'whitelist' })}
        />
        Whitelist (convert only on listed sites)
      </label>

      {host && converts !== null ? (
        <label className="oc-inline">
          <input
            type="checkbox"
            checked={converts}
            onChange={() => onChange(setSiteConverts(settings, host, !converts))}
          />
          Convert prices on {normalizeHost(host)}
        </label>
      ) : (
        <p>No convertible site in the active tab.</p>
      )}

      <p>{settings.siteListMode === 'whitelist' ? 'Whitelisted' : 'Blacklisted'} sites:</p>
      {list.length === 0 ? (
        <p>None yet.</p>
      ) : (
        <ul className="oc-chips">
          {list.map((site) => (
            <li key={site}>
              {site}{' '}
              <button
                type="button"
                aria-label={`Remove ${site}`}
                onClick={() =>
                  onChange({
                    [settings.siteListMode]: list.filter((s) => s !== site),
                  })
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
