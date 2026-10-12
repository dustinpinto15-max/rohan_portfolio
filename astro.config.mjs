import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import { readFileSync } from 'node:fs';

// The live URL comes from the CMS (Site Settings → Site URL).
const settings = JSON.parse(readFileSync(new URL('./src/data/settings.json', import.meta.url), 'utf8'));

export default defineConfig({
  site: settings.siteUrl,
  // Every page is static HTML. Only /api/auth and /api/callback
  // (the admin panel's GitHub login) run as small Vercel functions.
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'always' },
  compressHTML: true,
  // The 3D scene (Three.js) is one lazy-loaded file of about 140 KB gzipped.
  vite: { build: { chunkSizeWarningLimit: 700 } },
});
