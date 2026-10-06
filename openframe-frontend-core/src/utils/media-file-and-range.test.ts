import { describe, expect, it } from 'vitest';
import { formatProgramDateRange } from './format';
import { fileMediaType } from './media-type';

describe('fileMediaType', () => {
  it('reads the MIME type when the browser states one', () => {
    expect(fileMediaType({ type: 'image/png', name: 'a.png' })).toBe('image');
    expect(fileMediaType({ type: 'video/mp4', name: 'a.mp4' })).toBe('video');
    expect(fileMediaType({ type: 'image/heic', name: 'IMG_1.HEIC' })).toBe('image');
  });

  it('falls back to the extension: a HEIC photo with no stated type is a picture', () => {
    expect(fileMediaType({ type: '', name: 'IMG_4664.HEIC' })).toBe('image');
    expect(fileMediaType({ name: 'clip.MOV' })).toBe('video');
  });

  it('refuses anything else', () => {
    expect(fileMediaType({ type: 'application/pdf', name: 'a.pdf' })).toBeNull();
    expect(fileMediaType({ type: '', name: 'notes' })).toBeNull();
  });
});

describe('formatProgramDateRange', () => {
  const at = (iso: string, timezone: string | null = 'Europe/Rome') => ({
    instant: new Date(iso),
    utcDate: null,
    timezone,
  });

  it('prints a range inside one month', () => {
    expect(formatProgramDateRange(at('2026-08-14T08:00:00Z') as never, '2026-08-19T16:00:00Z')).toBe(
      'Aug 14 – 19, 2026',
    );
  });

  it('an end at midnight closes the day before it', () => {
    expect(formatProgramDateRange(at('2026-08-14T08:00:00Z') as never, '2026-08-20T22:00:00Z')).toBe(
      'Aug 14 – 20, 2026',
    );
  });

  it('prints both months and both years when they differ', () => {
    expect(formatProgramDateRange(at('2026-08-30T08:00:00Z') as never, '2026-09-02T10:00:00Z')).toBe(
      'Aug 30 – Sep 2, 2026',
    );
    expect(formatProgramDateRange(at('2026-12-30T08:00:00Z') as never, '2027-01-02T10:00:00Z')).toBe(
      'Dec 30, 2026 – Jan 2, 2027',
    );
  });

  it('is null for one day, a missing end or a backwards range', () => {
    expect(formatProgramDateRange(at('2026-08-14T08:00:00Z') as never, '2026-08-14T18:00:00Z')).toBeNull();
    expect(formatProgramDateRange(at('2026-08-14T08:00:00Z') as never, null)).toBeNull();
    expect(formatProgramDateRange(at('2026-08-14T08:00:00Z') as never, '2026-08-10T08:00:00Z')).toBeNull();
  });
});
