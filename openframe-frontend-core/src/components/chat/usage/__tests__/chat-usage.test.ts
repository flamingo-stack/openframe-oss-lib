/**
 * The Usage panel's rules: the context turns yellow at65% and red once past compaction, whatever the
 * backend's threshold, and the token figures never read as spent before they are.
 */

import { describe, expect, it } from 'vitest';
import {
  chatContextTone,
  compactionThresholdOf,
  contextRatio,
  formatTokensFull,
  formatTokensShort,
  formatUsd,
} from '../chat-usage';

describe('chatContextTone', () => {
  it('follows an actual 75% threshold: yellow from 65%, red past 75%', () => {
    expect(chatContextTone(64_900, 100_000, 0.75)).toBe('default');
    expect(chatContextTone(65_000, 100_000, 0.75)).toBe('warning');
    expect(chatContextTone(75_000, 100_000, 0.75)).toBe('warning');
    expect(chatContextTone(75_100, 100_000, 0.75)).toBe('error');
  });

  it('warns from 65% while following the backend compaction threshold', () => {
    expect(chatContextTone(64_999, 100_000, 0.8)).toBe('default');
    expect(chatContextTone(65_000, 100_000, 0.8)).toBe('warning');
    expect(chatContextTone(80_000, 100_000, 0.8)).toBe('warning');
    expect(chatContextTone(80_100, 100_000, 0.8)).toBe('error');
  });

  it('turns red at the first token past the actual compaction boundary', () => {
    expect(chatContextTone(120_000, 150_000, 0.8)).toBe('warning');
    expect(chatContextTone(120_001, 150_000, 0.8)).toBe('error');
  });

  it('is red when a smaller model leaves the chat over its budget', () => {
    expect(chatContextTone(40_000, 30_000, 0.8)).toBe('error');
  });

  it('reads unknown figures as the default, never as a warning', () => {
    expect(chatContextTone(null, 150_000)).toBe('default');
    expect(chatContextTone(12_000, null)).toBe('default');
    expect(chatContextTone(12_000, 0)).toBe('default');
  });
});

describe('compactionThresholdOf', () => {
  it('takes a share in (0, 1] and leaves absent or invalid ratios unknown', () => {
    expect(compactionThresholdOf(0.8)).toBe(0.8);
    expect(compactionThresholdOf(null)).toBeNull();
    expect(compactionThresholdOf(0)).toBeNull();
    expect(compactionThresholdOf(80)).toBeNull();
  });
});

describe('contextRatio', () => {
  it('is null without a budget', () => {
    expect(contextRatio(10, 0)).toBeNull();
    expect(contextRatio(undefined, 100)).toBeNull();
    expect(contextRatio(25, 100)).toBe(0.25);
  });
});

describe('token formats', () => {
  it('writes full figures with separators', () => {
    expect(formatTokensFull(12_840)).toBe('12,840');
  });

  it('writes short figures rounded down, in K below a million', () => {
    expect(formatTokensShort(3_200_000)).toBe('3.2M');
    expect(formatTokensShort(10_000_000)).toBe('10M');
    expect(formatTokensShort(9_960_000)).toBe('9.9M');
    expect(formatTokensShort(30_000)).toBe('30K');
    expect(formatTokensShort(800_000)).toBe('800K');
    expect(formatTokensShort(0)).toBe('0');
    expect(formatTokensShort(100_000_000_000)).toBe('100,000M');
  });

  it('writes dollars with two decimals and separators', () => {
    expect(formatUsd(38.4)).toBe('$38.40');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(1_000_000)).toBe('$1,000,000.00');
  });
});

it('keeps unknown compaction ratios unknown and does not infer a critical boundary', () => {
  expect(compactionThresholdOf(undefined)).toBeNull();
  expect(chatContextTone(95_000, 100_000, null)).toBe('warning');
});
