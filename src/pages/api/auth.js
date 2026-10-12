// Step 1 of the admin login: send the user to GitHub to sign in.
// Needs two Vercel environment variables: GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.
export const prerender = false;

export function GET({ url, cookies }) {
  const clientId = process.env.GITHUB_CLIENT_ID || import.meta.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response('GITHUB_CLIENT_ID is not set in Vercel environment variables.', { status: 500 });
  }
  const state = crypto.randomUUID();
  cookies.set('decap_oauth_state', state, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });

  const redirect = new URL('https://github.com/login/oauth/authorize');
  redirect.searchParams.set('client_id', clientId);
  redirect.searchParams.set('redirect_uri', `${url.origin}/api/callback`);
  redirect.searchParams.set('scope', url.searchParams.get('scope') || 'repo,user');
  redirect.searchParams.set('state', state);
  return Response.redirect(redirect.toString(), 302);
}
