import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };

// MV3 multi-entry build. @crxjs/vite-plugin reads manifest.json, rewrites its
// source entry points (service worker, content script, popup) to the built
// outputs, and emits an unpacked extension to dist/. See overview.md > Architecture.
export default defineConfig({
  plugins: [react(), crx({ manifest })],
});
