const ALLOWED_PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com", "wns2-pn1.notify.windows.com"];

export function isAllowedPushEndpoint(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    return ALLOWED_PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

export function canUsePushEndpoint(existingUserId: string | null, currentUserId: string) {
  return existingUserId === null || existingUserId === currentUserId;
}
