import { describe, expect, it } from 'vitest';
import { arrangePhotoWall, PHOTO_WALL_FRAME, photoOrientation, type PhotoOrientation } from './photo-wall';

const photo = (id: string, orientation: PhotoOrientation) => ({ id, orientation });
const columnHeight = (column: ReadonlyArray<{ orientation: PhotoOrientation }>) =>
  column.reduce((sum, item) => sum + 1 / PHOTO_WALL_FRAME[item.orientation], 0);

describe('photoOrientation', () => {
  it('reads the shape from the natural size', () => {
    expect(photoOrientation(800, 1200)).toBe('tall');
    expect(photoOrientation(1600, 900)).toBe('wide');
    expect(photoOrientation(1000, 1000)).toBe('square');
    expect(photoOrientation(1100, 1000)).toBe('square');
  });

  it('an unknown size is a landscape', () => {
    expect(photoOrientation(0, 0)).toBe('wide');
    expect(photoOrientation(Number.NaN, 100)).toBe('wide');
  });
});

describe('arrangePhotoWall', () => {
  const photos = [
    photo('w1', 'wide'),
    photo('w2', 'wide'),
    photo('w3', 'wide'),
    photo('w4', 'wide'),
    photo('t1', 'tall'),
    photo('t2', 'tall'),
    photo('s1', 'square'),
  ];

  it('places every picture exactly once', () => {
    const placed = arrangePhotoWall(photos, 2).flat();
    expect(placed.map(p => p.id).sort()).toEqual(photos.map(p => p.id).sort());
  });

  it('keeps the input order inside one orientation', () => {
    const wides = arrangePhotoWall(photos, 1)[0]
      .filter(p => p.orientation === 'wide')
      .map(p => p.id);
    expect(wides).toEqual(['w1', 'w2', 'w3', 'w4']);
  });

  it('never repeats a shape while another shape is left', () => {
    const order = arrangePhotoWall(photos, 1)[0].map(p => p.orientation);
    // 4 wide + 2 tall + 1 square: only the last pictures can be forced neighbours.
    expect(order.slice(0, 5).every((shape, i) => i === 0 || shape !== order[i - 1])).toBe(true);
  });

  it('ends the columns level (within one frame)', () => {
    const [a, b] = arrangePhotoWall(photos, 2);
    expect(Math.abs(columnHeight(a) - columnHeight(b))).toBeLessThanOrEqual(1 / PHOTO_WALL_FRAME.tall);
  });

  it('drops empty columns and survives no pictures', () => {
    expect(arrangePhotoWall([photo('only', 'wide')], 3)).toHaveLength(1);
    expect(arrangePhotoWall([], 2)).toEqual([]);
  });
});
