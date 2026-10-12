// Adds security and SEO headers to the Vercel build output.
// (The Astro Vercel adapter writes its own routing file, so vercel.json headers are not used.)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const file = '.vercel/output/config.json';
if (!existsSync(file)) { console.log('add-headers: no Vercel output found, skipped'); process.exit(0); }

const config = JSON.parse(readFileSync(file, 'utf8'));
const extra = [
  {
    src: '^/(.*)$',
    headers: {
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'SAMEORIGIN',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    },
    continue: true,
  },
  { src: '^/(admin|api)(?:/(.*))?$', headers: { 'x-robots-tag': 'noindex' }, continue: true },
];
config.routes = [...extra, ...config.routes.filter((r) => !extra.some((e) => e.src === r.src))];
writeFileSync(file, JSON.stringify(config, null, 2));
console.log('add-headers: security headers added');
