import { describe, expect, it } from 'vitest';
import { formatUrlForDisplay } from '../format';

describe('formatUrlForDisplay', () => {
  it('shows an address without scheme, www, query, fragment or trailing slash', () => {
    expect(formatUrlForDisplay('https://www.example.com/mobile')).toBe('example.com/mobile');
    expect(formatUrlForDisplay('http://example.com/mobile/?from=qr#top')).toBe('example.com/mobile');
  });

  it("keeps www when the address is shown as the site's own name", () => {
    expect(formatUrlForDisplay('https://www.techflow.com/', { keepWww: true })).toBe('www.techflow.com');
  });
});
