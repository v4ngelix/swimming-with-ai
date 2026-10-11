import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// `npm version` bumps package.json; the wall marks photos carrying that version as latest
const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  server: { open: true },
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  define: { __APP_VERSION__: JSON.stringify(version) },
});
