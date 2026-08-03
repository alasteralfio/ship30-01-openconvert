// The quick converter. The main source→target conversion is the real, saved one; the
// rest are previews of features we haven't wired up yet — the pinned-pair chips, the
// favourite stars, the "supports math" amount field, and the extra target rows. Those
// only live for the current popup session.

import { useMemo, useState } from 'react';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import CloseIcon from '@mui/icons-material/Close';
import { convert } from '../../shared/convert';
import { formatNumber } from '../../shared/format';
import type { RateCache, Settings } from '../../shared/storage';
import CurrencyCombobox from '../CurrencyCombobox';

interface Props {
  rates: RateCache;
  settings: Settings;
  codes: string[];
  update: (patch: Partial<Settings>) => void;
  resetSourceToAuto: () => void;
}

// Hard-coded for now; you'll be able to add and remove your own pairs later.
const PINNED_PAIRS: ReadonlyArray<[string, string]> = [
  ['USD', 'EUR'],
  ['GBP', 'JPY'],
  ['USD', 'SGD'],
];

export default function ConvertTab({ rates, settings, codes, update, resetSourceToAuto }: Props) {
  const [amount, setAmount] = useState('1');
  const amountNum = Number(amount);
  // Extra currencies to show the amount in, alongside the main target. Session-only.
  const [extraTargets, setExtraTargets] = useState<string[]>([]);

  /** Convert the current amount into `target`, formatted, or null if it can't. */
  function resultIn(target: string): string | null {
    if (amount.trim() === '' || !Number.isFinite(amountNum)) return null;
    try {
      const v = convert(amountNum, settings.source, target, rates.rates, settings.precision);
      return formatNumber(v, settings.numberFormat, settings.precision);
    } catch {
      return null;
    }
  }

  const primary = useMemo(
    () => resultIn(settings.target),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rates, settings, amount, amountNum],
  );

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle2" color="text.secondary">
          Convert
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Tooltip
            title={
              settings.sourceManuallySet
                ? 'Source is set manually — click to auto-detect the page currency again'
                : 'Auto-detect on: source follows the page currency'
            }
          >
            <IconButton
              aria-label="Auto-detect source currency"
              size="small"
              color={settings.sourceManuallySet ? 'default' : 'primary'}
              onClick={() => resetSourceToAuto()}
            >
              <MyLocationIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Rates refresh on a schedule (about every 6 hours), not live.">
            <InfoOutlinedIcon fontSize="small" color="disabled" />
          </Tooltip>
        </Stack>
      </Stack>

      {/* Quick-swap chips for common pairs */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
        {PINNED_PAIRS.map(([from, to]) => (
          <Chip
            key={`${from}-${to}`}
            label={`${from} → ${to}`}
            size="small"
            variant="outlined"
            onClick={() => update({ source: from, target: to, sourceManuallySet: true })}
          />
        ))}
        <Tooltip title="Pin the current pair (coming soon)">
          <Chip
            icon={<StarBorderIcon />}
            label="Pin"
            size="small"
            variant="outlined"
            sx={{ opacity: 0.6 }}
          />
        </Tooltip>
      </Box>

      <TextField
        label="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        // Takes a plain number or a math expression; for now only plain numbers convert.
        type="text"
        inputMode="decimal"
        fullWidth
        helperText="Supports math, e.g. 12 + 4.50 (evaluation coming soon)"
      />

      <CurrencyCombobox
        label="From"
        value={settings.source}
        codes={codes}
        showFavourite
        // A manual source change permanently locks out per-page auto-detect.
        onChange={(code) => update({ source: code, sourceManuallySet: true })}
      />

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Tooltip title="Swap source and target">
          <IconButton
            aria-label="Swap source and target"
            size="small"
            onClick={() =>
              update({
                source: settings.target,
                target: settings.source,
                sourceManuallySet: true,
              })
            }
          >
            <SwapVertIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <CurrencyCombobox
        label="To"
        value={settings.target}
        codes={codes}
        showFavourite
        onChange={(code) => update({ target: code })}
      />

      <Divider />

      {/* Primary result */}
      <Box>
        <Typography variant="caption" color="text.secondary">
          {Number.isFinite(amountNum) ? amountNum : '—'} {settings.source} =
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {primary === null ? '—' : `${primary} ${settings.target}`}
        </Typography>
      </Box>

      {/* The same amount in each extra currency */}
      {extraTargets.map((code) => {
        const v = resultIn(code);
        return (
          <Stack
            key={code}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="body2">
              {v === null ? '—' : `${v} ${code}`}
            </Typography>
            <IconButton
              size="small"
              aria-label={`Remove ${code}`}
              onClick={() => setExtraTargets((prev) => prev.filter((c) => c !== code))}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        );
      })}

      <CurrencyCombobox
        label="Convert to another currency"
        value=""
        clearOnSelect
        codes={codes.filter((c) => c !== settings.target && !extraTargets.includes(c))}
        onChange={(code) => setExtraTargets((prev) => [...prev, code])}
      />
    </Stack>
  );
}
