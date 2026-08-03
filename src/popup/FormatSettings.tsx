// Formatting controls: precision (decimal places) and the number-format picker, applied
// to converted output in both the popup and the page.

import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import type { Settings } from '../shared/storage';
import { FORMAT_LABELS } from '../shared/format';
import type { NumberFormat } from '../shared/format';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

const PRECISIONS = [0, 1, 2, 3, 4];
const FORMATS = Object.keys(FORMAT_LABELS) as NumberFormat[];

export default function FormatSettings({ settings, onChange }: Props) {
  return (
    <Stack spacing={1.5}>
      <TextField
        select
        label="Decimal places"
        value={settings.precision}
        onChange={(e) => onChange({ precision: Number(e.target.value) })}
        fullWidth
      >
        {PRECISIONS.map((p) => (
          <MenuItem key={p} value={p}>
            {p === 0 ? 'Nearest whole (0)' : p}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label="Number format"
        value={settings.numberFormat}
        onChange={(e) => onChange({ numberFormat: e.target.value as NumberFormat })}
        fullWidth
      >
        {FORMATS.map((f) => (
          <MenuItem key={f} value={f}>
            {FORMAT_LABELS[f]}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
