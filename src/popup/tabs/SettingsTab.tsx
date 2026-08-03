// Settings tab: the "How to use" modal and the formatting controls (precision + number
// format). The modal only has a one-line note for now — more to come.

import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import browser from 'webextension-polyfill';
import { sendToContent } from '../../shared/messaging';
import type { Settings } from '../../shared/storage';
import FormatSettings from '../FormatSettings';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

/** Ask the current page to show its in-page UI preview. */
async function previewInPage(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) {
    await sendToContent(tab.id, { type: 'previewShells' }).catch(() => undefined);
  }
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

      <Divider />

      <Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<VisibilityIcon />}
          onClick={() => void previewInPage()}
          fullWidth
        >
          Preview in-page UI
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          Shows mock versions of the upcoming in-page features (select-to-convert, page
          total, table column) on the current page.
        </Typography>
      </Box>

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
