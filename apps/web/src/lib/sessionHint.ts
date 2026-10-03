/**
 * Remembers on this device whether someone is signed in, so the app knows at once whether to
 * restore a session. Without it, a first-time visitor would wait for the API (up to a minute
 * when the free tier is asleep) just to learn they are signed out. It holds no secret: the
 * session itself is the httpOnly refresh cookie.
 */
const KEY = 'rlf_signed_in';

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage blocked: fall back to asking the API, as before
  }
}

export function setSessionHint(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: hasSessionHint() then always asks the API
  }
}
