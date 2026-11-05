/**
 * The slot the host's auth adapter (`setEmbedAuthAdapter`) is registered in, and the listeners told when it changes.
 *
 * Both are parked on `globalThis`, NOT in module-private `let`s. Reason: this lib ships multiple entry points
 * (`/utils`, `/components/chat`, …) and a consumer's bundler can inline a file into more than one chunk, giving each
 * chunk its OWN module scope. If the host calls `setEmbedAuthAdapter` from the `/utils` copy while the chat's
 * `embedAuthedFetch` runs from the `/components/chat` copy, a module-local `let` would be set on one copy and read as
 * `null` on the other (the exact "credentials: same-origin, no Bearer, no refresh" symptom). The listeners follow the
 * slot for the same reason: one registered in another copy must still hear about the change.
 *
 * No imports, so the readers (`embed-authed-fetch`, `app-origins`) do not depend on each other through it.
 */
const ADAPTER_GLOBAL_KEY = '__embedAuthedFetchAdapter__';
const LISTENERS_GLOBAL_KEY = '__embedAuthedFetchAdapterListeners__';

type Slots = Record<string, unknown>;

function listeners(): Set<() => void> {
  const slots = globalThis as Slots;
  let set = slots[LISTENERS_GLOBAL_KEY] as Set<() => void> | undefined;
  if (!set) {
    set = new Set();
    slots[LISTENERS_GLOBAL_KEY] = set;
  }
  return set;
}

/** The registered adapter, typed by the caller (the slot itself does not know the adapter's shape). */
export function readRegisteredAdapter<T>(): T | null {
  if (typeof globalThis === 'undefined') return null;
  return ((globalThis as Slots)[ADAPTER_GLOBAL_KEY] as T | null | undefined) ?? null;
}

/** Store the adapter (or `null`) and tell every listener, in every copy of this module. */
export function writeRegisteredAdapter(adapter: unknown): void {
  if (typeof globalThis === 'undefined') return;
  (globalThis as Slots)[ADAPTER_GLOBAL_KEY] = adapter;
  for (const listener of [...listeners()]) listener();
}

/** Called after every registration, replacement or clear. */
export function subscribeRegisteredAdapter(listener: () => void): () => void {
  if (typeof globalThis === 'undefined') return () => {};
  const set = listeners();
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}
