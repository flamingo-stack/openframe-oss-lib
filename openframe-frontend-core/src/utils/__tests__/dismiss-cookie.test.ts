/**
 * Tier selection on both sides of the cookie-averse split, plus the match rule
 * the two tiers feed.
 *
 * `document.URL` is stubbed rather than the document navigated: jsdom will not
 * take a `tauri://` document URL, and the scheme is the only input the tier
 * choice reads — so the stub sits exactly at the seam production reads.
 *
 * The round-trips run against the real stores rather than spies: reading a
 * value back is the only proof a write actually stuck, which is the whole
 * subject of this file.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearDismissCookie, isDismissedCookieValue, readDismissCookie, writeDismissCookie } from '../dismiss-cookie';

const KEY = 'openframe-walkthrough-video-dismissed';
const nativeUrlDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'URL');

function setDocumentUrl(url: string): void {
  Object.defineProperty(document, 'URL', { value: url, writable: true, configurable: true });
}

afterEach(() => {
  // Restore the native accessor rather than re-stubbing a hardcoded URL, which
  // would silently diverge from jsdom's own document URL if the vitest
  // environment is ever given an explicit one.
  if (nativeUrlDescriptor) Object.defineProperty(document, 'URL', nativeUrlDescriptor);
  clearDismissCookie(KEY);
});

describe('dismissal on an http(s) origin', () => {
  beforeEach(() => setDocumentUrl('https://openframe.ai/dashboard'));

  it('round-trips through the cookie', () => {
    writeDismissCookie(KEY, 'video-7');
    expect(document.cookie).toContain(`${KEY}=video-7`);
    expect(readDismissCookie(KEY)).toBe('video-7');
  });

  it('takes the cookie tier on plain http too', () => {
    // Dev runs on `http://localhost`. Were only `https:` accepted, it would
    // silently drop to the fallback tier, where SSR cannot see the dismissal.
    setDocumentUrl('http://localhost:3000/dashboard');
    writeDismissCookie(KEY, 'video-7');
    expect(document.cookie).toContain(`${KEY}=video-7`);
  });

  it('leaves the fallback tier untouched', () => {
    // Pins fallback-not-mirror; see `fallbackStore`.
    writeDismissCookie(KEY, 'video-7');
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('fails open on a malformed cookie value', () => {
    // `decodeURIComponent` throws `URIError` on bad percent-encoding; the other
    // half of the guarantee `readDismissCookie` documents.
    document.cookie = `${KEY}=%E0%A4%A; path=/`;
    expect(readDismissCookie(KEY)).toBeUndefined();
  });

  it('clears the cookie tier', () => {
    writeDismissCookie(KEY, 'video-7');
    clearDismissCookie(KEY);
    expect(document.cookie).not.toContain(KEY);
    expect(readDismissCookie(KEY)).toBeUndefined();
  });
});

describe('dismissal on a cookie-averse origin (tauri://, capacitor://)', () => {
  beforeEach(() => setDocumentUrl('tauri://localhost/index.html'));

  it('writes no cookie', () => {
    writeDismissCookie(KEY, 'video-7');
    expect(document.cookie).not.toContain(KEY);
  });

  it('persists through localStorage and keeps the id-match rule', () => {
    writeDismissCookie(KEY, 'video-7');
    // jsdom keys its cookie jar off the REAL document URL, not the stub above,
    // so a cookie-only implementation's write would still land here and serve
    // the reads below. Emptying the jar first is what makes them prove the
    // value came from the fallback tier; the assertion confirms the wipe took,
    // since a path or domain mismatch would leave the cookie in place and
    // hollow out both reads.
    document.cookie = `${KEY}=; path=/; max-age=0`;
    expect(document.cookie).not.toContain(KEY);

    // The positive half is the discriminator — asserting only the `video-8`
    // false would also pass against a fallback tier that stored nothing.
    expect(isDismissedCookieValue(readDismissCookie(KEY), 'video-7')).toBe(true);
    expect(isDismissedCookieValue(readDismissCookie(KEY), 'video-8')).toBe(false);
  });

  it('fails open on a corrupted stored value', () => {
    // Seeded through the real writer first, so this also pins the fallback key
    // to the cookie name: read a different key and the pre-corruption value
    // would still come back.
    writeDismissCookie(KEY, 'video-7');
    window.localStorage.setItem(KEY, 'not-json');
    // Callers reveal the surface off this read, so an unreadable value must
    // mean "not dismissed" rather than throwing and hiding it permanently.
    expect(readDismissCookie(KEY)).toBeUndefined();

    // Parses, but is not the string the tier stores — what `validate` is for.
    window.localStorage.setItem(KEY, '123');
    expect(readDismissCookie(KEY)).toBeUndefined();
  });
});

describe('the match rule itself', () => {
  it('treats "nothing stored, nothing active" as NOT dismissed', () => {
    // Both sides undefined is the case the `!!id` guard exists for: a bare
    // equality would call it dismissed and suppress a surface that has no
    // active item to be dismissed against.
    expect(isDismissedCookieValue(undefined, undefined)).toBe(false);
  });
});

describe('clearing across the tier split', () => {
  it('clears the tier the current scheme does NOT select', () => {
    // Written on the fallback tier, cleared from a document on the cookie tier
    // — the case a same-origin `blob:`/`about:blank` child produces, and the
    // one a tier-checking clear would leave stranded.
    setDocumentUrl('tauri://localhost/index.html');
    writeDismissCookie(KEY, 'video-7');

    setDocumentUrl('https://openframe.ai/dashboard');
    clearDismissCookie(KEY);

    setDocumentUrl('tauri://localhost/index.html');
    expect(readDismissCookie(KEY)).toBeUndefined();
  });
});
