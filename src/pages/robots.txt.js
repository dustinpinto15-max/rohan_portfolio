import settings from '../data/settings.json';
export function GET() {
  const site = settings.siteUrl.replace(/\/$/, '');
  return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
