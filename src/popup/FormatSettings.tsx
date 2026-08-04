// Formatting controls: precision (decimal places) and the number-format picker, applied
// to converted output in both the popup and the page. These use Autocomplete — the same
// anchored-dropdown (Popper) the currency pickers use — not a Select: a Select's menu opens
// as a page-covering modal in the small popup.

import Stack from '@mui/material/Stack';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import type { Settings } from '../shared/storage';
import { FORMAT_LABELS } from '../shared/format';
import type { NumberFormat } from '../shared/format';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

interface Opt<T> {
  value: T;
  label: string;
}

const PRECISION_OPTIONS: Opt<number>[] = [0, 1, 2, 3, 4].map((p) => ({
  value: p,
  label: p === 0 ? 'Nearest whole (0)' : String(p),
}));

const FORMAT_OPTIONS: Opt<NumberFormat>[] = (Object.keys(FORMAT_LABELS) as NumberFormat[]).map(
  (f) => ({ value: f, label: FORMAT_LABELS[f] }),
);

export default function FormatSettings({ settings, onChange }: Props) {
  const precision =
    PRECISION_OPTIONS.find((o) => o.value === settings.precision) ?? PRECISION_OPTIONS[2];
  const format =
    FORMAT_OPTIONS.find((o) => o.value === settings.numberFormat) ?? FORMAT_OPTIONS[0];

  return (
    <Stack spacing={1}>
      <Autocomplete<Opt<number>, false, true, false>
        options={PRECISION_OPTIONS}
        value={precision}
        onChange={(_, opt) => onChange({ precision: opt.value })}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(o, v) => o.value === v.value}
        disableClearable
        openOnFocus
        fullWidth
        renderInput={(params) => <TextField {...params} label="Decimal places" />}
        renderOption={(props, option) => (
          <li {...props} key={String(option.value)}>
            {option.label}
          </li>
        )}
      />
      <Autocomplete<Opt<NumberFormat>, false, true, false>
        options={FORMAT_OPTIONS}
        value={format}
        onChange={(_, opt) => onChange({ numberFormat: opt.value })}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(o, v) => o.value === v.value}
        disableClearable
        openOnFocus
        fullWidth
        renderInput={(params) => <TextField {...params} label="Number format" />}
        renderOption={(props, option) => (
          <li {...props} key={String(option.value)}>
            {option.label}
          </li>
        )}
      />
    </Stack>
  );
}
