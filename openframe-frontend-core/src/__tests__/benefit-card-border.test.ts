import { describe, expect, it } from 'vitest';
import { benefitCardBorderClass } from '../components/ui/benefit-card';

const has = (cls: string, token: string) => cls.split(' ').includes(token);

describe('benefitCardBorderClass — the 3-column grid (1-up / 2-up / 3-up)', () => {
  const total = 3;
  const [first, second, third] = [0, 1, 2].map(i => benefitCardBorderClass(i, total, 3));

  it('draws a row divider between stacked cards on a phone, none after the last', () => {
    expect(has(first, 'border-b')).toBe(true);
    expect(has(second, 'border-b')).toBe(true);
    expect(has(third, 'border-b')).toBe(false);
  });

  it('at md (two per row) the row ends after card two: right border on card one only, no divider under the last row', () => {
    expect(has(first, 'content-md:border-r')).toBe(true);
    expect(has(second, 'content-md:border-r-0')).toBe(true);
    expect(has(third, 'content-md:border-b-0')).toBe(true);
    expect(has(second, 'content-md:border-b-0')).toBe(false);
  });

  it('at lg (one row) every card but the last has a right border and none has a bottom one', () => {
    expect(has(first, 'content-lg:border-r')).toBe(true);
    expect(has(second, 'content-lg:border-r')).toBe(true);
    expect(has(third, 'content-lg:border-r-0')).toBe(true);
    expect([first, second, third].every(c => has(c, 'content-lg:border-b-0'))).toBe(true);
  });
});
