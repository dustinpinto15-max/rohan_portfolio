// Step 2 of the admin login: GitHub sends the user back here.
// We swap the code for a token and hand it to the admin panel window.
export const prerender = false;

const page = (status, content) => `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signing in…</title></head>
<body style="background:#000;color:#fff;font-family:system-ui;display:grid;place-items:center;height:100vh">
<p>${status === 'success' ? 'Signed in. You can close this window.' : 'Sign-in failed. Please close this window and try again.'}</p>
<script>
(function () {
  var msg = 'authorization:github:${status}:' + ${JSON.stringify(JSON.stringify(content)).replace(/</g, '\\u003c')};
  function receive(e) {
    window.opener.postMessage(msg, e.origin);
    window.removeEventListener('message', receive, false);
  }
  if (!window.opener) return;
  window.addEventListener('message', receive, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script></body></html>`;

const html = (body, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function GET({ url, cookies }) {
  const clientId = process.env.GITHUB_CLIENT_ID || import.meta.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || import.meta.env.GITHUB_CLIENT_SECRET;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = cookies.get('decap_oauth_state')?.value;
  cookies.delete('decap_oauth_state', { path: '/' });

  if (!clientId || !clientSecret) return html(page('error', { message: 'GitHub keys are missing in Vercel.' }), 500);
  if (!code || !state || state !== saved) return html(page('error', { message: 'Invalid sign-in request.' }), 400);

  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: `${url.origin}/api/callback` }),
    });
    const data = await res.json();
    if (!data.access_token) return html(page('error', { message: data.error_description || 'No token returned.' }), 401);
    return html(page('success', { token: data.access_token, provider: 'github' }));
  } catch (err) {
    return html(page('error', { message: 'Could not reach GitHub.' }), 502);
  }
}
