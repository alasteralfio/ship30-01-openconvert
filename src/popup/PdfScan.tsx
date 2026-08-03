// Shown in the Convert tab when the active tab is a PDF. Reads the PDF's prices and lists
// them converted to the target. PDF.js is heavy, so it's imported only when the user
// actually scans — the module load and the parse both happen behind this one button.

import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import type { RateCache, Settings } from '../shared/storage';
import type { PdfPrice } from './pdf';

interface Props {
  url: string;
  rates: RateCache;
  settings: Settings;
  target: string;
}

type State =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'done'; prices: PdfPrice[] }
  | { status: 'error'; message: string };

export default function PdfScan({ url, rates, settings, target }: Props) {
  const [state, setState] = useState<State>({ status: 'idle' });

  async function scan(): Promise<void> {
    setState({ status: 'scanning' });
    try {
      const { scanPdfPrices } = await import('./pdf');
      const prices = await scanPdfPrices(url, rates, settings, target);
      setState({ status: 'done', prices });
    } catch {
      setState({
        status: 'error',
        message: "Couldn't read this PDF (it may be an image scan or blocked from access).",
      });
    }
  }

  return (
    <Card variant="outlined">
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <PictureAsPdfIcon fontSize="small" color="error" />
            <Typography variant="subtitle2">PDF prices</Typography>
          </Stack>

          <Button
            variant="outlined"
            size="small"
            onClick={() => void scan()}
            disabled={state.status === 'scanning'}
            startIcon={
              state.status === 'scanning' ? <CircularProgress size={14} /> : undefined
            }
          >
            {state.status === 'scanning' ? 'Scanning…' : `Scan this PDF → ${target}`}
          </Button>

          {state.status === 'error' && (
            <Typography variant="caption" color="error">
              {state.message}
            </Typography>
          )}

          {state.status === 'done' && state.prices.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              No prices found in this PDF.
            </Typography>
          )}

          {state.status === 'done' && state.prices.length > 0 && (
            <Box sx={{ maxHeight: 180, overflowY: 'auto' }}>
              <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
                {state.prices.map((p, i) => (
                  <Stack
                    key={`${p.original}-${i}`}
                    direction="row"
                    justifyContent="space-between"
                    sx={{ py: 0.5 }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {p.original}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {p.converted}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
