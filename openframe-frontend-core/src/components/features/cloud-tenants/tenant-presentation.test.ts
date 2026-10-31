import { describe, expect, it } from 'vitest';
import { licenseSummaryLines, usersCountLabel } from './tenant-presentation';

describe('licenseSummaryLines', () => {
  it('is the empty mark until the numbers have been read', () => {
    expect(licenseSummaryLines(null)).toEqual({ value: '—', detail: null, warning: false });
  });

  it('says the total is not available where the provider reports none', () => {
    expect(licenseSummaryLines({ assigned: 88, purchased: null, unused: null })).toEqual({
      value: '88 assigned',
      detail: 'Total not available',
      warning: false,
    });
  });

  it('calls out what Figma 3025-3536 calls out, and leaves the rest', () => {
    expect(licenseSummaryLines({ assigned: 118, purchased: 120, unused: 2 })).toEqual({
      value: '118 of 120',
      detail: '2 unused',
      warning: false,
    });
    for (const [assigned, purchased, unused] of [
      [396, 450, 54],
      [184, 225, 41],
      [57, 75, 18],
    ]) {
      expect(licenseSummaryLines({ assigned, purchased, unused }).warning).toBe(true);
    }
  });

  it('never reads a seat count below zero', () => {
    expect(licenseSummaryLines({ assigned: 12, purchased: 10, unused: -2 })).toEqual({
      value: '12 of 10',
      detail: '2 over',
      warning: false,
    });
  });
});

describe('usersCountLabel', () => {
  it('counts users, and is the empty mark before the first read', () => {
    expect(usersCountLabel(1)).toBe('1 user');
    expect(usersCountLabel(257)).toBe('257 users');
    expect(usersCountLabel(null)).toBe('—');
  });
});
