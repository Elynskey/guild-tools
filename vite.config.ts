import path from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));

export default defineConfig({
  plugins: [react()],
  // Build-time constant, not an IPC round-trip to Electron's app.getVersion() -- the
  // version number is static build metadata, not a runtime OS concern, so this works
  // in the dev server and a plain browser too, not just the packaged app.
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Relative asset paths, not Vite's default absolute "/assets/...": the packaged
  // Electron app loads dist/index.html via file://, which has no server root for an
  // absolute path to resolve against — confirmed live that this produces a totally
  // blank window (index.html itself loads, so the title shows, but the JS bundle
  // 404s and #root never mounts). The dev server and a real HTTP host both still
  // resolve "./assets/..." correctly, so this doesn't affect `npm run dev`.
  base: './',
  server: {
    // The top-level assets/, _ds/, and screenshots/ folders are the original design
    // handoff bundle (reference material), not served by the app — only public/assets
    // is. release/ and build-resources/ are electron-builder's installer output.
    // Watching any of these is pointless and, over OneDrive-synced folders, flaky
    // (file locks can throw EBUSY and crash the dev server — confirmed live for both
    // assets/icons/ during an asset download and release/ during an installer build).
    watch: {
      ignored: [
        path.resolve(__dirname, 'assets') + '/**',
        path.resolve(__dirname, '_ds') + '/**',
        path.resolve(__dirname, 'screenshots') + '/**',
        path.resolve(__dirname, 'release') + '/**',
        path.resolve(__dirname, 'build-resources') + '/**',
      ],
    },
  },
  test: {
    environment: 'node',
  },
});
