const KEY = "taskhub-device-id";

/**
 * A random ID kept in this browser, sent with sign-up so the limit is per
 * device as well as per IP: a shared carrier IP is not blocked by one person's
 * sign-ups, and one device cannot make accounts in bulk by changing network.
 * It is not a secret and not proof of anything; clearing browser data makes a
 * new one, and the IP limit still applies.
 */
export function getDeviceId(): string {
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Storage blocked (private mode): the IP limit alone applies.
    return "none";
  }
}
