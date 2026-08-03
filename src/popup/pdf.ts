// Pull the prices out of a PDF and convert them. Chrome's built-in PDF viewer renders
// through a plugin whose text a content script can't reach, so we don't rewrite prices in
// place there — instead we fetch the PDF, read its text with PDF.js (loaded on demand so
// it never weighs down the normal popup), detect the prices, and list the conversions.

import * as pdfjs from 'pdfjs-dist';
import { convert } from '../shared/convert';
import { formatNumber } from '../shared/format';
import { detectPrices } from '../content/detect';
import type { DetectionContext } from '../content/detect';
import type { RateCache, Settings } from '../shared/storage';

// The worker ships as a bundled asset; this URL form lets the bundler emit + resolve it.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

export interface PdfPrice {
  /** The price as it appears in the PDF. */
  original: string;
  /** Resolved source ISO code. */
  currency: string;
  /** Converted value, formatted with the target code (e.g. "46.02 EUR"). */
  converted: string;
}

/**
 * Fetch the PDF at `url`, extract its text, and return each detected price converted to
 * `target`. Throws if the PDF can't be fetched or read.
 */
export async function scanPdfPrices(
  url: string,
  rates: RateCache,
  settings: Settings,
  target: string,
): Promise<PdfPrice[]> {
  const data = await (await fetch(url)).arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;

  const ctx: DetectionContext = {
    knownCodes: new Set(Object.keys(rates.rates)),
    host: '',
    lang: '',
    fromFilter: settings.fromFilter,
  };

  const prices: PdfPrice[] = [];
  for (let page = 1; page <= doc.numPages; page++) {
    const content = await (await doc.getPage(page)).getTextContent();
    const text = content.items.map((it) => ('str' in it ? it.str : '')).join(' ');
    for (const m of detectPrices(text, ctx)) {
      try {
        const value = convert(m.amount, m.currency, target, rates.rates, settings.precision);
        prices.push({
          original: m.text,
          currency: m.currency,
          converted: `${formatNumber(value, settings.numberFormat, settings.precision)} ${target}`,
        });
      } catch {
        /* currency missing from the cached table */
      }
    }
  }
  return prices;
}
