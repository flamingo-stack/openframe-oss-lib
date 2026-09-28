/**
 * The `localStorageUpdate` CustomEvent contract.
 *
 * `CustomEvent.detail` is typed `any`, and `addEventListener` types a
 * non-standard event name as a bare `Event` — so every listener used to
 * re-derive the payload shape by hand off an `any`. The decode lives here
 * once: an event dispatched by anything on the page is untrusted input, so it
 * is validated rather than asserted.
 *
 * Dispatchers: `saveOnboardingState` (utils/onboarding-storage.ts).
 * Listeners: `useLocalStorage`, `useOnboardingState`.
 */

export interface LocalStorageUpdateDetail {
  /** Storage key that changed. */
  key: string;
  /** Serialized new value; `null` when the key was removed or cleared. */
  newValue: string | null;
}

/**
 * Decode a `localStorageUpdate` event payload.
 *
 * Returns `null` — never throws — when the event is not a CustomEvent, carries
 * no object detail, or the detail does not match the contract above. A missing
 * or `undefined` `newValue` is normalized to `null`, which is the "key was
 * removed" signal.
 */
export function readLocalStorageUpdateDetail(event: Event): LocalStorageUpdateDetail | null {
  if (!('detail' in event)) return null;

  const detail: unknown = event.detail;
  if (typeof detail !== 'object' || detail === null) return null;
  if (!('key' in detail) || typeof detail.key !== 'string') return null;

  const newValue: unknown = 'newValue' in detail ? detail.newValue : null;
  if (newValue !== null && newValue !== undefined && typeof newValue !== 'string') return null;

  return { key: detail.key, newValue: newValue ?? null };
}
