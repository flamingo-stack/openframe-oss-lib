import { describe, expect, it } from 'vitest';
import { isAnnouncementOnSurface } from '../announcement-surface';

describe('isAnnouncementOnSurface', () => {
  it('is true for a listed surface and false for any other', () => {
    expect(isAnnouncementOnSurface({ surfaces: ['web', 'desktop'] }, 'desktop')).toBe(true);
    expect(isAnnouncementOnSurface({ surfaces: ['web', 'desktop'] }, 'mobile')).toBe(false);
  });

  it('is true everywhere when no surface is listed', () => {
    expect(isAnnouncementOnSurface({}, 'mobile')).toBe(true);
    expect(isAnnouncementOnSurface({ surfaces: null }, 'mobile')).toBe(true);
    expect(isAnnouncementOnSurface({ surfaces: [] }, 'mobile')).toBe(true);
  });
});
