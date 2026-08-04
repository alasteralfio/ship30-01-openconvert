// Sites tab: on-page conversion controls. The "Live price conversion" master switch is
// the global kill switch (settings.enabled); turning it off greys every control below.
// Display mode + highlight + currency filter + per-site rules all gate on it.

import { useEffect, useRef } from 'react';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import type { Settings } from '../../shared/storage';
import FromFilter from '../FromFilter';
import SiteRules from '../SiteRules';

interface Props {
  settings: Settings;
  host: string | null;
  codes: string[];
  update: (patch: Partial<Settings>) => void;
}

export default function SitesTab({ settings, host, codes, update }: Props) {
  // `inert` (not yet in React's HTML attribute types) keeps this section fully out of
  // the tab order and unclickable while greyed, not just visually dimmed — pointer-events
  // alone left every control beneath still reachable and operable by keyboard.
  const gatedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (gatedRef.current) gatedRef.current.inert = !settings.enabled;
  }, [settings.enabled]);

  return (
    <Stack spacing={1}>
      <FormControlLabel
        control={
          <Switch
            checked={settings.enabled}
            onChange={() => update({ enabled: !settings.enabled })}
          />
        }
        label={
          <Box>
            <Typography variant="subtitle2">Live price conversion</Typography>
            <Typography variant="caption" color="text.secondary">
              Rewrite prices on pages as you browse.
            </Typography>
          </Box>
        }
      />

      <Stack
        ref={gatedRef}
        spacing={1}
        aria-disabled={!settings.enabled}
        sx={{ opacity: settings.enabled ? 1 : 0.45 }}
      >
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Display mode
          </Typography>
          <ToggleButtonGroup
            value={settings.displayMode}
            exclusive
            size="small"
            color="primary"
            fullWidth
            onChange={(_, next: Settings['displayMode'] | null) =>
              next && update({ displayMode: next })
            }
          >
            <ToggleButton value="replace">Replace price</ToggleButton>
            <ToggleButton value="hover">Show on hover</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary">
            {settings.displayMode === 'replace'
              ? 'Show the converted price; original on hover.'
              : 'Keep the original price; converted on hover.'}
          </Typography>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={settings.highlight}
              onChange={() => update({ highlight: !settings.highlight })}
            />
          }
          label="Highlight converted prices"
        />

        <FromFilter
          value={settings.fromFilter}
          codes={codes}
          onChange={(list) => update({ fromFilter: list })}
        />

        <SiteRules
          settings={settings}
          host={host}
          codes={codes}
          onChange={(patch) => update(patch)}
        />
      </Stack>
    </Stack>
  );
}
