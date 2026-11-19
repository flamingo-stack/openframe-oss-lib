/**
 * The Usage panel's rules: the context turns yellow ten points before compaction and red once past it, whatever the
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
  reportedCompactionThreshold,
} from '../chat-usage';

describe('chatContextTone', () => {
  it('follows the default 75% threshold: yellow from 65%, red past 75%', () => {
    expect(chatContextTone(64_900, 100_000)).toBe('default');
    expect(chatContextTone(65_000, 100_000)).toBe('warning');
    expect(chatContextTone(75_000, 100_000)).toBe('warning');
    expect(chatContextTone(75_100, 100_000)).toBe('error');
  });

  it('follows the backend threshold: at 80%, yellow from 70%, red past 80%', () => {
    expect(chatContextTone(69_900, 100_000, 0.8)).toBe('default');
    expect(chatContextTone(70_000, 100_000, 0.8)).toBe('warning');
    expect(chatContextTone(80_000, 100_000, 0.8)).toBe('warning');
    expect(chatContextTone(80_100, 100_000, 0.8)).toBe('error');
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
  it('takes a share in (0, 1] and falls back to 75% otherwise', () => {
    expect(compactionThresholdOf(0.8)).toBe(0.8);
    expect(compactionThresholdOf(null)).toBe(0.75);
    expect(compactionThresholdOf(0)).toBe(0.75);
    expect(compactionThresholdOf(80)).toBe(0.75);
  });
});

describe('reportedCompactionThreshold', () => {
  it("is the backend's share, and null when it reported none: the panel never writes the design's 75%", () => {
    expect(reportedCompactionThreshold(0.8)).toBe(0.8);
    expect(reportedCompactionThreshold(1)).toBe(1);
    expect(reportedCompactionThreshold(null)).toBeNull();
    expect(reportedCompactionThreshold(undefined)).toBeNull();
    expect(reportedCompactionThreshold(0)).toBeNull();
    expect(reportedCompactionThreshold(80)).toBeNull();
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

  it('writes short figures rounded down: K below a million, M below a billion, B from it (as Billing does)', () => {
    expect(formatTokensShort(3_200_000)).toBe('3.2M');
    expect(formatTokensShort(10_000_000)).toBe('10M');
    expect(formatTokensShort(9_960_000)).toBe('9.9M');
    expect(formatTokensShort(30_000)).toBe('30K');
    expect(formatTokensShort(800_000)).toBe('800K');
    expect(formatTokensShort(0)).toBe('0');
    expect(formatTokensShort(100_000_000_000)).toBe('100B');
    expect(formatTokensShort(1_000_000_000)).toBe('1B');
    expect(formatTokensShort(1_990_000_000)).toBe('1.9B');
    expect(formatTokensShort(999_999_999)).toBe('999.9M');
  });

  it('writes dollars with two decimals and separators', () => {
    expect(formatUsd(38.4)).toBe('$38.40');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(1_000_000)).toBe('$1,000,000.00');
  });
});
