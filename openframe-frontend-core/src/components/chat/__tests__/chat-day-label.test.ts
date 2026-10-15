import { describe, expect, it } from 'vitest';
import { chatDayLabel } from '../utils/chat-day-label';

const NOW = new Date(2026, 9, 15, 10, 30); // 15 Oct 2026, local

describe('chatDayLabel', () => {
  it('names today and yesterday by local day', () => {
    expect(chatDayLabel(new Date(2026, 9, 15, 0, 1), NOW)).toBe('Today');
    expect(chatDayLabel(new Date(2026, 9, 14, 23, 59), NOW)).toBe('Yesterday');
    expect(chatDayLabel(new Date(2026, 9, 14, 0, 0), NOW)).toBe('Yesterday');
  });

  // The day itself follows the viewer's locale ("9 Oct" / "Oct 9").
  it('gives an older day as "9 Oct", with the year outside this one', () => {
    expect(chatDayLabel(new Date(2026, 9, 9, 12), NOW)).toMatch(/^(9 Oct|Oct 9)$/);
    expect(chatDayLabel(new Date(2025, 9, 9, 12), NOW)).toMatch(/^(9 Oct 2025|Oct 9, 2025)$/);
  });

  it('reads an ISO string, and a clock slightly ahead as today', () => {
    expect(chatDayLabel(new Date(2026, 9, 9, 12).toISOString(), NOW)).toMatch(/^(9 Oct|Oct 9)$/);
    expect(chatDayLabel(new Date(2026, 9, 15, 11), NOW)).toBe('Today');
  });

  it('is null without a usable timestamp', () => {
    expect(chatDayLabel(undefined, NOW)).toBeNull();
    expect(chatDayLabel(null, NOW)).toBeNull();
    expect(chatDayLabel('not a date', NOW)).toBeNull();
  });
});
