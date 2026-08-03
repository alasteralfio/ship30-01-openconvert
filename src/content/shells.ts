// A preview of three in-page features we haven't built yet — the select-to-convert
// toast, the page total, and the "convert this column" button — so we can settle on how
// they look. Nothing here reads the page or converts anything; it's just for show, and it
// only appears when you hit "Preview in-page UI" in the popup, never while browsing.
//
// There's no React or MUI on the page, so we build the DOM by hand and inject one small
// stylesheet. Its colours and shapes match the popup theme so the two feel like one app.

const STYLE_ID = 'oc-shell-style';
const PREVIEW_ID = 'oc-shell-preview';

const CSS = `
#${PREVIEW_ID}{position:fixed;right:16px;bottom:16px;z-index:2147483647;
  display:flex;flex-direction:column;gap:12px;width:280px;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;
  animation:oc-shell-in .18s ease-out;}
@keyframes oc-shell-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.oc-shell-card{background:#fff;border:1px solid rgba(0,0,0,.10);border-radius:10px;
  box-shadow:0 8px 28px rgba(0,0,0,.16);padding:12px 14px;}
.oc-shell-tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.04em;
  text-transform:uppercase;color:#1976d2;background:rgba(25,118,210,.10);
  border-radius:6px;padding:2px 6px;margin-bottom:8px;}
.oc-shell-label{font-size:12px;color:#666;}
.oc-shell-value{font-size:20px;font-weight:700;line-height:1.2;}
.oc-shell-sub{font-size:11px;color:#888;margin-top:2px;}
.oc-shell-btn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;
  font-weight:600;color:#fff;background:#1976d2;border:none;border-radius:8px;
  padding:8px 12px;cursor:pointer;}
.oc-shell-header{display:flex;align-items:center;justify-content:space-between;
  font-size:11px;font-weight:600;color:#888;padding:0 2px;}
.oc-shell-close{border:none;background:none;color:#888;cursor:pointer;font-size:16px;
  line-height:1;padding:2px 4px;border-radius:6px;}
.oc-shell-close:hover{background:rgba(0,0,0,.06);color:#333;}
`;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head ?? document.documentElement).appendChild(style);
}

/** A titled card with a small feature tag. */
function card(tag: string, body: (el: HTMLDivElement) => void): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'oc-shell-card';
  const tagEl = document.createElement('span');
  tagEl.className = 'oc-shell-tag';
  tagEl.textContent = tag;
  el.appendChild(tagEl);
  body(el);
  return el;
}

/** The select-to-convert toast. */
function selectToConvertCard(): HTMLDivElement {
  return card('Select to convert', (el) => {
    const label = document.createElement('div');
    label.className = 'oc-shell-label';
    label.textContent = 'Selected “$49.99”';
    const value = document.createElement('div');
    value.className = 'oc-shell-value';
    value.textContent = '€46.02';
    const sub = document.createElement('div');
    sub.className = 'oc-shell-sub';
    sub.textContent = 'USD → EUR';
    el.append(label, value, sub);
  });
}

/** The page total panel. */
function pageTotalCard(): HTMLDivElement {
  return card('Page total', (el) => {
    const value = document.createElement('div');
    value.className = 'oc-shell-value';
    value.textContent = '€1,234.56';
    const sub = document.createElement('div');
    sub.className = 'oc-shell-sub';
    sub.textContent = '12 prices converted · this page';
    el.append(value, sub);
  });
}

/** The "convert this column" button for prices in a table. */
function convertColumnCard(): HTMLDivElement {
  return card('Table column', (el) => {
    const label = document.createElement('div');
    label.className = 'oc-shell-label';
    label.textContent = 'Prices detected in a table column';
    label.style.marginBottom = '8px';
    const btn = document.createElement('button');
    btn.className = 'oc-shell-btn';
    btn.type = 'button';
    btn.textContent = '⤓ Convert column to EUR';
    el.append(label, btn);
  });
}

/**
 * Drop the preview cards onto the page, clearing any previous set. They can be dismissed
 * with the × and clear themselves after a while.
 */
export function renderShellPreview(): void {
  injectStyle();
  document.getElementById(PREVIEW_ID)?.remove();

  const container = document.createElement('div');
  container.id = PREVIEW_ID;

  const header = document.createElement('div');
  header.className = 'oc-shell-header';
  const title = document.createElement('span');
  title.textContent = 'OpenConvert · in-page preview';
  const close = document.createElement('button');
  close.className = 'oc-shell-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss preview');
  close.textContent = '×';
  close.addEventListener('click', () => container.remove());
  header.append(title, close);

  container.append(header, selectToConvertCard(), pageTotalCard(), convertColumnCard());
  (document.body ?? document.documentElement).appendChild(container);

  window.setTimeout(() => container.remove(), 15000);
}
