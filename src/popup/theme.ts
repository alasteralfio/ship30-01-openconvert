// The popup's one theme: a neutral grey dark mode. Mid-dark canvas, lighter cards, hairline
// light borders. mode:'dark' so MUI derives the dependent text/border/icon colours; accents
// stay on the standard palette. No toggle.

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#2b2d31', // canvas behind the cards — the darker grey
      paper: '#3a3d42', // the cards themselves — a lighter grey that lifts off the canvas
    },
    divider: 'rgba(255, 255, 255, 0.12)',
  },
  shape: {
    borderRadius: 10,
  },
  // Type scale (documented in overview.md > UI > Typography). One variant per role,
  // sizes stepping down monotonically so nothing secondary ever outweighs a header:
  //   h5        20px/700  reserved largest step (currently unused)
  //   h6        15px/700  dialog titles
  //   subtitle2 13px/600  every section header ("Convert", "Display mode", …)
  //   body1/2   12px/400  interactive + result text (switch labels, rows, dialog body)
  //   caption   11px/400  descriptions, helper text, footnotes, field labels
  //   button    12px/600  tabs and buttons
  // Form controls (input/label/menu/chip) are pinned to the same steps below so they
  // don't drift back to MUI's defaults (which is how body1 labels ended up beating headers).
  typography: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: 12,
    h5: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2 },
    h6: { fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.01em' },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.35 },
    body1: { fontSize: '0.75rem', lineHeight: 1.45 },
    body2: { fontSize: '0.75rem', lineHeight: 1.45 },
    caption: { fontSize: '0.6875rem', lineHeight: 1.4 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' },
  },
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid rgba(255, 255, 255, 0.10)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiFormControl: {
      defaultProps: { size: 'small' },
    },
    MuiInputBase: {
      styleOverrides: { input: { fontSize: '0.8125rem' } },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: '0.8125rem' } },
    },
    MuiMenuItem: {
      styleOverrides: { root: { fontSize: '0.75rem' } },
    },
    MuiFormControlLabel: {
      styleOverrides: { label: { fontSize: '0.75rem' } },
    },
    MuiChip: {
      styleOverrides: { label: { fontSize: '0.6875rem' } },
    },
  },
});

export default theme;
