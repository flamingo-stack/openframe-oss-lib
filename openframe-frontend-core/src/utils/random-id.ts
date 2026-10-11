/**
 * THE random id of the library: a version 4 UUID, in every runtime it runs in
 * (a browser, a webview, the server). Every id made up on the spot (an
 * optimistic row, a form attempt, an anonymous viewer) comes from here, so no
 * caller carries its own fallback for a runtime without `crypto.randomUUID`.
 */
export function randomId(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (typeof crypto.getRandomValues === 'function') {
      // RFC 4122 version 4 from random bytes, for a runtime that predates `randomUUID`.
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
