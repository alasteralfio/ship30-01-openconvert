// The popup's one and only theme. We keep MUI's default palette and just tune the shape,
// density, and surfaces for a flatter, more modern feel: a grey canvas, white cards, and
// hairline borders instead of drop shadows. No light/dark toggle — one look everywhere.

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#f5f6f8',
      paper: '#ffffff',
    },
    divider: 'rgba(0, 0, 0, 0.08)',
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: 13,
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
    h6: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
  },
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiFormControl: {
      defaultProps: { size: 'small' },
    },
  },
});

export default theme;
