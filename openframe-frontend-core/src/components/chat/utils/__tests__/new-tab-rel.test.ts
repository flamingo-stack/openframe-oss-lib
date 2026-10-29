import { describe, expect, it } from 'vitest';
import { newTabFeatures, newTabRel } from '../new-tab-rel';

describe('newTabRel', () => {
  it('keeps the Referer for one of our platforms, by host', () => {
    expect(newTabRel('https://openframe.ai/auth?__hstc=1')).toBe('noopener');
    expect(newTabRel('https://www.openframe.ai/')).toBe('noopener');
    expect(newTabRel('https://openmsp.ai/vendors')).toBe('noopener');
  });

  it('keeps the Referer for a named platform and for a path of this site', () => {
    expect(newTabRel('https://example.com/x', 'openframe')).toBe('noopener');
    expect(newTabRel('/admin/blog/preview/x')).toBe('noopener');
  });

  it('drops it for a third party', () => {
    expect(newTabRel('https://businessof.tech/2025/10/31/some-post/')).toBe('noopener noreferrer');
    expect(newTabRel('//evil.example/x')).toBe('noopener noreferrer');
  });

  it('writes the same rule as window.open features', () => {
    expect(newTabFeatures('https://openframe.ai/auth')).toBe('noopener');
    expect(newTabFeatures('https://example.com/x')).toBe('noopener,noreferrer');
  });
});
