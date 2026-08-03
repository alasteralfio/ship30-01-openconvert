// The in-page cards behind the right-click features — a converted selection, a page or
// selection total, a table-column total. There's no framework on the page, so we build the
// DOM by hand and match the popup theme's colours and shapes.

const STYLE_ID = 'oc-overlay-style';
const CARD_ID = 'oc-overlay-card';

const CSS = `
#${CARD_ID}{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:260px;
  background:#fff;border:1px solid rgba(0,0,0,.10);border-radius:10px;
  box-shadow:0 8px 28px rgba(0,0,0,.16);padding:12px 14px;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;
  animation:oc-overlay-in .18s ease-out;}
@keyframes oc-overlay-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
#${CARD_ID} .oc-ov-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
#${CARD_ID} .oc-ov-tag{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  color:#1976d2;background:rgba(25,118,210,.10);border-radius:6px;padding:2px 6px;}
#${CARD_ID} .oc-ov-close{border:none;background:none;color:#888;cursor:pointer;font-size:16px;
  line-height:1;padding:2px 4px;border-radius:6px;}
#${CARD_ID} .oc-ov-close:hover{background:rgba(0,0,0,.06);color:#333;}
#${CARD_ID} .oc-ov-label{font-size:12px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#${CARD_ID} .oc-ov-value{font-size:20px;font-weight:700;line-height:1.2;}
#${CARD_ID} .oc-ov-sub{font-size:11px;color:#888;margin-top:2px;}
`;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head ?? document.documentElement).appendChild(style);
}

export interface OverlayCard {
  /** Small uppercase label, e.g. "Converted" or "Page total". */
  tag: string;
  /** Optional greyed context line above the value (e.g. the original text). */
  label?: string;
  /** The headline value, e.g. "€46.02" or "1,234.56 EUR". */
  value: string;
  /** Optional footnote (e.g. "USD → EUR" or "12 prices"). */
  sub?: string;
}

function line(className: string, text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}

/** Show a single overlay card bottom-right, replacing any previous one. Auto-dismisses. */
export function showOverlayCard(card: OverlayCard): void {
  injectStyle();
  document.getElementById(CARD_ID)?.remove();

  const el = document.createElement('div');
  el.id = CARD_ID;

  const head = document.createElement('div');
  head.className = 'oc-ov-head';
  head.appendChild(line('oc-ov-tag', card.tag));
  const close = document.createElement('button');
  close.className = 'oc-ov-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  close.addEventListener('click', () => el.remove());
  head.appendChild(close);
  el.appendChild(head);

  if (card.label) el.appendChild(line('oc-ov-label', card.label));
  el.appendChild(line('oc-ov-value', card.value));
  if (card.sub) el.appendChild(line('oc-ov-sub', card.sub));

  (document.body ?? document.documentElement).appendChild(el);
  window.setTimeout(() => el.remove(), 10000);
}
