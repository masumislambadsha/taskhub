const KEY = "taskhub-device-id";
const COOKIE = "th_did";

function readCookie(): string | null {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(document.cookie);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * A random ID for this browser, kept in two places so clearing one does not
 * make a new device: localStorage, and a long-lived cookie (which the server
 * also sees on sign-in, where no custom header is sent). It is used for the
 * sign-up limit and for finding one person running many accounts. It is not a
 * secret and not proof of anything; clearing all browser data makes a new one.
 */
export function getDeviceId(): string {
  try {
    let id: string | null = null;
    try {
      id = window.localStorage.getItem(KEY);
    } catch {
      // storage blocked: the cookie may still work
    }
    id = id || readCookie();
    if (!id) id = crypto.randomUUID();
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      // ignore
    }
    document.cookie = `${COOKIE}=${encodeURIComponent(id)}; Max-Age=${400 * 24 * 3600}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    return id;
  } catch {
    // No storage and no cookies: the IP limit alone applies.
    return "none";
  }
}
