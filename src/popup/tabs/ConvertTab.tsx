// The quick converter. The amount field takes a plain number or a small sum like
// "12 + 4.50". Below the main source→target result, the amount is also shown in each of
// the extra currencies you've added (the multi-target view), and the pinned pairs at the
// top are one-tap shortcuts. Both lists are saved in Settings.

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
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import CloseIcon from '@mui/icons-material/Close';
import { convert } from '../../shared/convert';
import { formatNumber } from '../../shared/format';
import { evaluateExpression } from '../../shared/expr';
import type { RateCache, Settings } from '../../shared/storage';
import CurrencyCombobox from '../CurrencyCombobox';
import PdfScan from '../PdfScan';

interface Props {
  rates: RateCache;
  settings: Settings;
  codes: string[];
  /** Active tab's URL when it's a PDF, else null — shows the PDF price scanner. */
  pdfUrl: string | null;
  update: (patch: Partial<Settings>) => void;
  resetSourceToAuto: () => void;
}

export default function ConvertTab({
  rates,
  settings,
  codes,
  pdfUrl,
  update,
  resetSourceToAuto,
}: Props) {
  const [amount, setAmount] = useState('1');
  // A plain number, an evaluated expression, or null when the field can't be read.
  const amountNum = evaluateExpression(amount);
  // Non-empty but unreadable — hint at it inline instead of a silent dash.
  const amountInvalid = amount.trim() !== '' && amountNum === null;

  /** Convert the current amount into `target`, formatted, or null if it can't. */
  function resultIn(target: string): string | null {
    if (amountNum === null) return null;
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
    [rates, settings, amountNum],
  );

  const addMultiTarget = (code: string) => {
    if (!settings.multiTargets.includes(code)) {
      update({ multiTargets: [...settings.multiTargets, code] });
    }
  };
  const removeMultiTarget = (code: string) => {
    update({ multiTargets: settings.multiTargets.filter((c) => c !== code) });
  };

  // Extra currencies shown together, minus the main target (already the big result).
  const multiTargets = settings.multiTargets.filter((c) => c !== settings.target);

  const pairPinned = settings.pinnedPairs.some(
    (p) => p.from === settings.source && p.to === settings.target,
  );
  const togglePinCurrentPair = () => {
    update({
      pinnedPairs: pairPinned
        ? settings.pinnedPairs.filter(
            (p) => !(p.from === settings.source && p.to === settings.target),
          )
        : [...settings.pinnedPairs, { from: settings.source, to: settings.target }],
    });
  };

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
          <Tooltip title={pairPinned ? 'Unpin this pair' : 'Pin this pair'}>
            <IconButton
              aria-label={pairPinned ? 'Unpin current pair' : 'Pin current pair'}
              size="small"
              color={pairPinned ? 'primary' : 'default'}
              onClick={togglePinCurrentPair}
            >
              {pairPinned ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Rates refresh on a schedule (about every 6 hours), not live.">
            <InfoOutlinedIcon fontSize="small" color="disabled" />
          </Tooltip>
        </Stack>
      </Stack>

      {pdfUrl && (
        <PdfScan url={pdfUrl} rates={rates} settings={settings} target={settings.target} />
      )}

      {/* Saved pairs — one tap loads a pair; the active one is highlighted */}
      {settings.pinnedPairs.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {settings.pinnedPairs.map(({ from, to }) => {
            const active = from === settings.source && to === settings.target;
            return (
              <Chip
                key={`${from}-${to}`}
                label={`${from} → ${to}`}
                size="small"
                variant={active ? 'filled' : 'outlined'}
                color={active ? 'primary' : 'default'}
                onClick={() => update({ source: from, target: to, sourceManuallySet: true })}
                onDelete={() =>
                  update({
                    pinnedPairs: settings.pinnedPairs.filter(
                      (p) => !(p.from === from && p.to === to),
                    ),
                  })
                }
              />
            );
          })}
        </Box>
      )}

      <TextField
        label="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        // Takes a plain number or a math expression (see shared/expr).
        type="text"
        inputMode="decimal"
        fullWidth
        error={amountInvalid}
        helperText={
          amountInvalid
            ? "Can't read that yet — keep typing, or check the expression."
            : 'Supports math, e.g. 12 + 4.50'
        }
      />

      <CurrencyCombobox
        label="From"
        value={settings.source}
        codes={codes}
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
        onChange={(code) => update({ target: code })}
      />

      <Divider />

      {/* Primary result */}
      <Box>
        <Typography variant="caption" color="text.secondary">
          {amountNum === null
            ? '—'
            : formatNumber(amountNum, settings.numberFormat, settings.precision)}{' '}
          {settings.source} =
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {primary === null ? '—' : `${primary} ${settings.target}`}
        </Typography>
      </Box>

      {/* The same amount in each extra currency */}
      {multiTargets.map((code) => {
        const v = resultIn(code);
        return (
          <Stack key={code} direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="body2">{v === null ? '—' : `${v} ${code}`}</Typography>
            <IconButton
              size="small"
              aria-label={`Remove ${code}`}
              onClick={() => removeMultiTarget(code)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        );
      })}

      <CurrencyCombobox
        label="Also convert to"
        value=""
        clearOnSelect
        codes={codes.filter(
          (c) => c !== settings.target && !settings.multiTargets.includes(c),
        )}
        onChange={addMultiTarget}
      />
    </Stack>
  );
}
