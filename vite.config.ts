/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };

// crxjs assumes an MV3 build context; skip it under Vitest so the pure-logic unit
// tests (convert, etc.) run without the extension machinery.
const underTest = process.env.VITEST !== undefined;

// MV3 multi-entry build. @crxjs/vite-plugin reads manifest.json, rewrites its
// source entry points (service worker, content script, popup) to the built
// outputs, and emits an unpacked extension to dist/. See overview.md > Architecture.
export default defineConfig({
  plugins: underTest ? [] : [react(), crx({ manifest })],
  build: {
    // Don't inject <link rel="modulepreload"> into the popup HTML. On the popup's
    // chrome-extension:// origin those preloads never resolve to a used resource
    // (Chrome logs "cross-world resource mismatch / preloaded but not used"), and the
    // popup loads its chunks on open anyway — there's nothing to gain from preloading.
    modulePreload: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Stub webextension-polyfill so modules that import `browser` (storage, …) can
    // be pulled into pure-logic tests without a real extension runtime.
    setupFiles: ['./src/test-setup.ts'],
  },
});
