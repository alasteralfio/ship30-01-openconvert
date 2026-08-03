// Vitest setup. Extension modules (storage, messaging, …) import
// `webextension-polyfill` at load, which throws outside a real browser extension.
// The pure-logic unit tests never touch the `browser.*` API, so a bare stub lets
// them import those modules without pulling in the extension runtime.
import { vi } from 'vitest';

vi.mock('webextension-polyfill', () => ({ default: {} }));
