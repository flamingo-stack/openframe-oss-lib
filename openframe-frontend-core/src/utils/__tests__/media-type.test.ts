import { describe, expect, it } from 'vitest';
import { MEDIA_TYPE, isImageMedia, isPublishableMediaType, isVideoMedia, partitionMediaByType } from '../media-type';

describe('media-type', () => {
  it('predicates read the discriminator and tolerate missing rows', () => {
    expect(isVideoMedia({ media_type: MEDIA_TYPE.VIDEO })).toBe(true);
    expect(isImageMedia({ media_type: MEDIA_TYPE.VIDEO })).toBe(false);
    expect(isVideoMedia(null)).toBe(false);
    expect(isImageMedia(undefined)).toBe(false);
  });

  it('only image and video are publishable', () => {
    expect(isPublishableMediaType('image')).toBe(true);
    expect(isPublishableMediaType('video')).toBe(true);
    expect(isPublishableMediaType('figma_export')).toBe(false);
    expect(isPublishableMediaType(null)).toBe(false);
  });

  it('partitions in order', () => {
    const rows = [
      { id: 1, media_type: 'video' },
      { id: 2, media_type: 'image' },
      { id: 3, media_type: 'video' },
      { id: 4, media_type: 'logo' },
    ];
    const { videos, images } = partitionMediaByType(rows);
    expect(videos.map(r => r.id)).toEqual([1, 3]);
    expect(images.map(r => r.id)).toEqual([2]);
  });
});
