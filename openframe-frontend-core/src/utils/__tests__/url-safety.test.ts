import { describe, expect, it } from 'vitest';

import { UNSAFE_URL_CHARS, isSameOriginPath, safeHref } from '../url-safety';

/**
 * The shared URL-safety predicate, tested once for BOTH callers — the wire
 * decoder (`linkUrl`) and the render-time guard (`safeHref`). They used to hold
 * their own copies, kept in sync by a comment, and the copies already disagreed
 * on the backslash case: a single-slash path that the URL parser resolves to a
 * third-party origin passed every "starts with exactly one slash" check and
 * reached an anchor tag.
 */
describe('isSameOriginPath', () => {
  const escapes = ['/\\evil.test/x', '/\\\\evil.test/x', '//evil.test/x', '/\\/evil.test/x', 'https://evil.test/x'];

  it.each(escapes)('rejects %s — it does not stay on this origin', href => {
    expect(isSameOriginPath(href)).toBe(false);
  });

  it.each(['/ok/x', '/a/b?q=1#frag', '/%2Fnot-an-authority', '/'])('accepts %s', href => {
    expect(isSameOriginPath(href)).toBe(true);
  });
});

describe('safeHref uses the same rule', () => {
  it('rejects the backslash escape the decoder rejects', () => {
    expect(safeHref('/\\evil.test/x')).toBeNull();
    expect(safeHref('//evil.test/x')).toBeNull();
  });

  it('still accepts what it is supposed to', () => {
    expect(safeHref('/onboarding-guides/x')).toBe('/onboarding-guides/x');
    expect(safeHref('#section')).toBe('#section');
    expect(safeHref('https://x.test/a')).toBe('https://x.test/a');
    expect(safeHref('mailto:a@b.test')).toBe('mailto:a@b.test');
  });

  it('rejects control and zero-width characters', () => {
    expect(UNSAFE_URL_CHARS.test('/a' + String.fromCharCode(0) + 'b')).toBe(true);
    expect(safeHref('/a' + String.fromCharCode(0x200b) + 'b')).toBeNull();
    expect(UNSAFE_URL_CHARS.test('/ordinary/path')).toBe(false);
  });
});

