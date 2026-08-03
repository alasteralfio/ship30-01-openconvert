// Settings tab: the "How to use" modal and the formatting controls (precision + number
// format). The modal only has a one-line note for now — more to come.

import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import type { Settings } from '../../shared/storage';
import FormatSettings from '../FormatSettings';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export default function SettingsTab({ settings, update }: Props) {
  const [howTo, setHowTo] = useState(false);

  return (
    <Stack spacing={2}>
      <Button
        variant="contained"
        size="large"
        startIcon={<HelpOutlineIcon />}
        onClick={() => setHowTo(true)}
        fullWidth
      >
        How to use OpenConvert
      </Button>

      <Divider />

      <Typography variant="subtitle2">Number formatting</Typography>
      <FormatSettings settings={settings} onChange={update} />

      <Dialog open={howTo} onClose={() => setHowTo(false)} maxWidth="xs" fullWidth>
        <DialogTitle>How to use OpenConvert</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Set your target currency on the Convert tab, then turn on “Live price
            conversion” on the Sites tab. Prices on the pages you browse are rewritten
            into your target currency automatically.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHowTo(false)}>Got it</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
