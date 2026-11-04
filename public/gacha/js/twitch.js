// "Log in with Twitch": the OAuth implicit grant, run against the Twitch app the Sarxina Plugin Manager
// already uses (public client id, no secret). Run locally, Twitch sends the login back to
// http://localhost:8921/callback, which is why the gacha runs on that port. Served from a website (sarxina.com/gacha/),
// it comes back to "callback" next to the page, e.g. https://sarxina.com/gacha/callback; that address has to be on the
// Twitch app's list of redirect URLs too. No scopes are asked for: the page only needs the viewer's
// name and picture, and it revokes the token as soon as it has them.
export const CLIENT_ID = '7pt77gkod0z7lv6npo45d6njqnrtz7';
const LOCAL = location.hostname === 'localhost';
const HOME = LOCAL ? '/' : new URL('./', document.baseURI).pathname;   // the folder the page lives in
export const REDIRECT_URI = LOCAL ? 'http://localhost:8921/callback' : `${location.origin}${HOME}callback`;
const STATE_KEY = 'sarxina-gacha-oauth-state';

export function startLogin() {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem(STATE_KEY, state); } catch { /* private window: the state check is skipped */ }
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', '');
  url.searchParams.set('state', state);
  location.assign(url.toString());
}

/** On /callback: turn Twitch's answer into a user, or an error. Returns null when this is not a callback. */
export async function finishLogin() {
  if (!/\/callback\/?$/.test(location.pathname)) return null;
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  history.replaceState(null, '', HOME);
  const error = query.get('error') || hash.get('error');
  if (error) return { error: query.get('error_description') || hash.get('error_description') || error };
  const token = hash.get('access_token');
  if (!token) return { error: 'Twitch did not send a login back.' };
  let expected = null;
  try { expected = sessionStorage.getItem(STATE_KEY); sessionStorage.removeItem(STATE_KEY); } catch { /* ignore */ }
  if (expected && hash.get('state') !== expected) return { error: 'That login did not come from this page. Try again.' };
  try {
    const res = await fetch('https://api.twitch.tv/helix/users', { headers: { Authorization: `Bearer ${token}`, 'Client-Id': CLIENT_ID } });
    if (!res.ok) return { error: `Twitch said ${res.status} when asked who you are.` };
    const u = (await res.json()).data?.[0];
    if (!u) return { error: 'Twitch did not say who you are.' };
    return { user: { login: u.login, display: u.display_name || u.login, avatar: u.profile_image_url || '', via: 'twitch' } };
  } finally {
    // the page has what it needs; the token is not kept anywhere
    fetch('https://id.twitch.tv/oauth2/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, token }),
    }).catch(() => {});
  }
}
