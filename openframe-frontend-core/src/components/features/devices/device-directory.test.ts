import { describe, expect, it } from 'vitest';
import { directorySourceLabel, directoryUserLines, directoryUserLinkLabel } from './device-directory';

describe('directoryUserLines', () => {
  it('names the primary user', () => {
    expect(directoryUserLines({ directoryUserLink: 'PRIMARY', directoryUserName: 'Olivia Grant' })).toEqual({
      name: 'Olivia Grant',
      detail: 'Primary user',
    });
  });

  it('counts the users of a shared device, singular for one', () => {
    expect(directoryUserLines({ directoryUserLink: 'SHARED', directoryUserCount: 2 })).toEqual({
      name: 'Shared',
      detail: '2 recent users',
    });
    expect(directoryUserLines({ directoryUserLink: 'SHARED', directoryUserCount: 1 }).detail).toBe('1 recent user');
  });

  it('draws the empty mark when nobody is tied, or nothing is known', () => {
    expect(directoryUserLines({ directoryUserLink: 'NONE' })).toEqual({ name: '—', detail: null });
    expect(directoryUserLines({})).toEqual({ name: '—', detail: null });
  });
});

describe('labels', () => {
  it("uses Figma's words", () => {
    expect(directoryUserLinkLabel('NONE')).toBe('No user');
    expect(directorySourceLabel('MICROSOFT_365')).toBe('M365');
    expect(directorySourceLabel('GOOGLE_WORKSPACE')).toBe('GOOGLE');
  });

  it('keeps a value this build does not know', () => {
    expect(directoryUserLinkLabel('NEW')).toBe('NEW');
    expect(directorySourceLabel('NEW')).toBe('NEW');
  });

  it('keeps a value named like an inherited key', () => {
    expect(directoryUserLinkLabel('toString')).toBe('toString');
    expect(directorySourceLabel('constructor')).toBe('constructor');
  });
});
