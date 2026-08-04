// From-filter control: which source currencies on a page get rewritten. An empty list
// means "All"; turning off "Convert every currency" restricts to a chosen set built via
// the combobox.

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import CurrencyCombobox from './CurrencyCombobox';

interface Props {
  /** Chosen source codes; empty = All. */
  value: string[];
  /** All selectable ISO codes (keys of the cached rate table). */
  codes: string[];
  onChange: (list: string[]) => void;
}

export default function FromFilter({ value, codes, onChange }: Props) {
  const all = value.length === 0;

  return (
    <Card variant="outlined">
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Stack spacing={1}>
          <Box>
            <Typography variant="subtitle2">Currency filter</Typography>
            <Typography variant="caption" color="text.secondary">
              Choose which currencies on a page get converted.
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={all}
                // Leaving "All" seeds a starting list so the state isn't ambiguous;
                // removing the last chip flips back to All automatically.
                onChange={(e) => onChange(e.target.checked ? [] : ['USD'])}
              />
            }
            label="Convert every currency"
          />

          {!all && (
            <Stack spacing={1}>
              <CurrencyCombobox
                label="Add a currency"
                value=""
                clearOnSelect
                codes={codes.filter((c) => !value.includes(c))}
                onChange={(code) => {
                  if (!value.includes(code)) onChange([...value, code]);
                }}
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {value.map((code) => (
                  <Chip
                    key={code}
                    label={code}
                    onDelete={() => onChange(value.filter((c) => c !== code))}
                    size="small"
                  />
                ))}
              </Box>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
