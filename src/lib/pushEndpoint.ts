/**
 * Only the real browser push services are accepted as a destination, so a registered "device" can never
 * make the server send requests to an internal or arbitrary address.
 */
export function isKnownPushEndpoint(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    const h = u.hostname.toLowerCase();
    return (
      h === "fcm.googleapis.com" ||
      h === "push.services.mozilla.com" ||
      h.endsWith(".push.services.mozilla.com") ||
      h.endsWith(".push.apple.com") ||
      h.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}
