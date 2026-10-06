import { describe, expect, it } from 'vitest';
import { PHOTO_WALL_FRAME, arrangePhotoWall, photoOrientation } from '../photo-wall';

describe('photoOrientation', () => {
  it('reads a portrait, a landscape and a square from the natural size', () => {
    expect(photoOrientation(800, 1200)).toBe('tall');
    expect(photoOrientation(1600, 900)).toBe('wide');
    expect(photoOrientation(1000, 1000)).toBe('square');
    expect(photoOrientation(1080, 1000)).toBe('square');
  });

  it('treats an unknown size as a landscape', () => {
    expect(photoOrientation(0, 0)).toBe('wide');
  });
});

describe('arrangePhotoWall', () => {
  const photo = (id: string, orientation: 'tall' | 'wide' | 'square') => ({ id, orientation });
  const heightOf = (column: Array<{ orientation: 'tall' | 'wide' | 'square' }>) =>
    column.reduce((sum, p) => sum + 1 / PHOTO_WALL_FRAME[p.orientation], 0);

  it('places every picture exactly once', () => {
    const photos = [
      photo('a', 'wide'),
      photo('b', 'tall'),
      photo('c', 'wide'),
      photo('d', 'square'),
      photo('e', 'wide'),
    ];
    const columns = arrangePhotoWall(photos, 2);
    expect(
      columns
        .flat()
        .map(p => p.id)
        .sort(),
    ).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('keeps the columns level', () => {
    const photos = [
      photo('t1', 'tall'),
      photo('t2', 'tall'),
      photo('t3', 'tall'),
      photo('w1', 'wide'),
      photo('w2', 'wide'),
      photo('w3', 'wide'),
      photo('w4', 'wide'),
      photo('s1', 'square'),
    ];
    const [left, right] = arrangePhotoWall(photos, 2);
    // Never further apart than the tallest single frame.
    expect(Math.abs(heightOf(left) - heightOf(right))).toBeLessThanOrEqual(1 / PHOTO_WALL_FRAME.tall);
  });

  it('does not deal one orientation twice in a row while another is left', () => {
    const photos = [photo('w1', 'wide'), photo('w2', 'wide'), photo('t1', 'tall'), photo('t2', 'tall')];
    const dealt = arrangePhotoWall(photos, 1)[0].map(p => p.orientation);
    expect(dealt.some((orientation, i) => i > 0 && orientation === dealt[i - 1])).toBe(false);
  });

  it('keeps the caller order inside an orientation', () => {
    const photos = [photo('w1', 'wide'), photo('w2', 'wide'), photo('w3', 'wide')];
    expect(arrangePhotoWall(photos, 1)[0].map(p => p.id)).toEqual(['w1', 'w2', 'w3']);
  });

  it('drops empty columns when there are fewer pictures than columns', () => {
    expect(arrangePhotoWall([photo('a', 'wide')], 3)).toHaveLength(1);
  });
});
