# OpenConvert Privacy Policy

Last updated: 2026-08-06

OpenConvert is a browser extension that converts currency amounts, both in its
popup and by rewriting prices on the web pages you visit. This policy explains what
the extension accesses and what happens to that data.

## What the extension accesses

- **Website content.** To convert prices in place, the content script reads the text
  of the pages you visit so it can find and rewrite currency amounts. When you use a
  right-click action, it reads the text you selected, the prices on the page, or a
  table cell. When you scan a PDF, it reads the text of that PDF.

## How that data is handled

- All of this is processed **locally on your device**. Page content, selections, and
  PDF text are never sent to us or to any third party. OpenConvert has no server and
  no account system.
- Your settings (chosen currencies, per-site rules and target overrides, display
  options, number formatting, pinned pairs, and the multi-target list) and the cached
  exchange-rate table are stored locally using the browser's storage. They stay on
  your device.

## Network requests

The only network requests the extension makes are to two public exchange-rate
services, open.er-api.com and api.frankfurter.dev, to fetch currency rates. These
requests ask for rate data only. They contain no personal information and no content
from the pages you visit.

## Data we collect, sell, or share

None. OpenConvert does not collect, transmit, sell, or share any user data. There is
nothing sent off your device except the rate lookups described above.

## Contact

Questions or concerns can be raised as an issue on the project's GitHub repository:
https://github.com/alasteralfio/ship30-01-openconvert/issues
