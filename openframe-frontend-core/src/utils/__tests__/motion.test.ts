/**
 * The motion vocabulary is written once in `MOTION_EASING` and mirrored as CSS variables for stylesheets: the two must
 * say the same thing, and no curve may overshoot (no bounce, no spring).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOTION_DURATION_MS, MOTION_EASING } from '../motion';

const css = readFileSync(resolve(__dirname, '../../styles/ods-design-tokens.css'), 'utf8');

/** A cubic-bezier's four numbers. */
const points = (value: string): number[] => {
  const match = /^cubic-bezier\(([^)]*)\)$/.exec(value.trim());
  if (!match) throw new Error(`not a cubic-bezier: ${value}`);
  return match[1].split(',').map(n => Number(n.trim()));
};

describe('motion tokens', () => {
  it.each(Object.entries(MOTION_EASING))('--ease-%s in the stylesheet is the same curve', (name, value) => {
    const declared = new RegExp(`--ease-${name}:\\s*([^;]+);`).exec(css)?.[1];
    expect(declared, `--ease-${name} is not declared`).toBeDefined();
    expect(points(declared as string)).toEqual(points(value));
  });

  it.each(Object.entries(MOTION_EASING))('%s never overshoots', (_name, value) => {
    for (const n of points(value)) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });

  it('an exit is faster than an entry', () => {
    expect(MOTION_DURATION_MS.exit).toBeLessThan(MOTION_DURATION_MS.enter);
  });
});
