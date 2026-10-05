import { describe, expect, it } from 'vitest';
import { isValidPathPattern, matchesPathPattern, pathMatchesAny } from '../path-pattern';

describe('path patterns', () => {
  it('a plain path matches itself and nothing longer', () => {
    expect(matchesPathPattern('/', '/')).toBe(true);
    expect(matchesPathPattern('/blog', '/')).toBe(false);
    expect(matchesPathPattern('/blog/post', '/blog')).toBe(false);
  });

  it('a regular expression matches the whole pathname', () => {
    expect(matchesPathPattern('/blog/post', '/blog/.*')).toBe(true);
    expect(matchesPathPattern('/blog', '/blog(/.*)?')).toBe(true);
    expect(matchesPathPattern('/pricing', '/(pricing|trial)')).toBe(true);
    expect(matchesPathPattern('/pricing/enterprise', '/(pricing|trial)')).toBe(false);
  });

  it('a pattern that does not compile is invalid and matches nothing', () => {
    expect(isValidPathPattern('/blog/(')).toBe(false);
    expect(matchesPathPattern('/blog/(', '/blog/(')).toBe(false);
    expect(isValidPathPattern('  ')).toBe(false);
    expect(isValidPathPattern('/blog/.*')).toBe(true);
  });

  it('matches against a list', () => {
    expect(pathMatchesAny('/careers', ['/', '/careers'])).toBe(true);
    expect(pathMatchesAny('/about', ['/', '/careers'])).toBe(false);
    expect(pathMatchesAny('/about', null)).toBe(false);
  });
});
