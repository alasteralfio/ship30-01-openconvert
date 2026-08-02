import { createRoot } from 'react-dom/client';
import App from './App';
import './popup.css';
import { sendMessage } from '../shared/messaging';
import { convert } from '../shared/convert';

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);

// Temporary Checkpoint 2.2 testing hook (popup context) — proves the round trip
// popup → worker message → cached rates → local convert(). Replaced by the real
// converter UI in Checkpoint 3.1. From the popup console:
//   const c = await openconvert.getRates();
//   openconvert.convert(100, 'USD', 'EUR', c.rates);
(window as unknown as { openconvert: unknown }).openconvert = {
  getRates: () => sendMessage({ type: 'getRates' }),
  refreshRates: () => sendMessage({ type: 'refreshRates' }),
  convert,
};
