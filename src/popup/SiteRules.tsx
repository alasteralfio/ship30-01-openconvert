// Per-site allow/deny controls. The active mode selects which list is enforced; the two
// lists persist independently, so switching modes never clears the other. The toggle and
// list edits go through shared/sites so the popup, content script, and context menu stay
// in agreement. The two lists are shown side by side, the inactive one greyed.

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import type { Settings } from '../shared/storage';
import {
  normalizeHost,
  siteConverts,
  setSiteConverts,
  siteTarget,
  setSiteTarget,
} from '../shared/sites';
import CurrencyCombobox from './CurrencyCombobox';

interface Props {
  settings: Settings;
  /** Active tab's hostname, or null on a non-web page (chrome://, new tab, …). */
  host: string | null;
  /** All selectable ISO codes, for the per-site target picker. */
  codes: string[];
  onChange: (patch: Partial<Settings>) => void;
}

/** A single named list column (whitelist or blacklist), greyed when inactive. */
function ListColumn({
  title,
  sites,
  active,
  onRemove,
}: {
  title: string;
  sites: string[];
  active: boolean;
  onRemove: (site: string) => void;
}) {
  return (
    <Box sx={{ flex: 1, opacity: active ? 1 : 0.4 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {title}
        {active ? ' · active' : ''}
      </Typography>
      {sites.length === 0 ? (
        <Typography variant="caption" color="text.disabled" display="block">
          None yet.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
          {sites.map((site) => (
            <Chip
              key={site}
              label={site}
              size="small"
              onDelete={active ? () => onRemove(site) : undefined}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function SiteRules({ settings, host, codes, onChange }: Props) {
  const converts = host ? siteConverts(host, settings) : null;
  const mode = settings.siteListMode;
  const override = host ? siteTarget(host, settings) : null;

  return (
    <Card variant="outlined">
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Stack spacing={1}>
          <Box>
            <Typography variant="subtitle2">Per-site rules</Typography>
            <Typography variant="caption" color="text.secondary">
              {mode === 'whitelist'
                ? 'Convert only on whitelisted sites.'
                : 'Convert everywhere except blacklisted sites.'}
            </Typography>
          </Box>

          <ToggleButtonGroup
            value={mode}
            exclusive
            size="small"
            color="primary"
            fullWidth
            onChange={(_, next: Settings['siteListMode'] | null) =>
              next && onChange({ siteListMode: next })
            }
          >
            <ToggleButton value="blacklist">Blacklist</ToggleButton>
            <ToggleButton value="whitelist">Whitelist</ToggleButton>
          </ToggleButtonGroup>

          {host && converts !== null ? (
            <>
              <FormControlLabel
                control={
                  <Switch
                    checked={converts}
                    onChange={() => onChange(setSiteConverts(settings, host, !converts))}
                  />
                }
                label={
                  <Typography variant="body2">
                    Convert prices on <strong>{normalizeHost(host)}</strong>
                  </Typography>
                }
              />
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography variant="caption" color="text.secondary">
                    Always show this site in (optional)
                  </Typography>
                  {override && (
                    <Link
                      component="button"
                      type="button"
                      variant="caption"
                      underline="hover"
                      onClick={() => host && onChange(setSiteTarget(settings, host, ''))}
                    >
                      Use global ({settings.target})
                    </Link>
                  )}
                </Stack>
                <CurrencyCombobox
                  label="Target for this site"
                  value={override ?? ''}
                  codes={codes}
                  onChange={(code) => host && onChange(setSiteTarget(settings, host, code))}
                />
              </Box>
            </>
          ) : (
            <Typography variant="caption" color="text.disabled">
              No convertible site in the active tab.
            </Typography>
          )}

          {/* Column order mirrors the mode toggle above: Blacklist left, Whitelist right. */}
          <Stack direction="row" spacing={1}>
            <ListColumn
              title="Blacklist"
              sites={settings.blacklist}
              active={mode === 'blacklist'}
              onRemove={(site) =>
                onChange({ blacklist: settings.blacklist.filter((s) => s !== site) })
              }
            />
            <ListColumn
              title="Whitelist"
              sites={settings.whitelist}
              active={mode === 'whitelist'}
              onRemove={(site) =>
                onChange({ whitelist: settings.whitelist.filter((s) => s !== site) })
              }
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
