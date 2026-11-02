import { describe, expect, it } from 'vitest';
import { stripCitationChips } from '../citation-chip';

describe('stripCitationChips', () => {
  it('removes a run with the space before it, before punctuation and mid-sentence', () => {
    expect(stripCitationChips('Run the installer [1]. Then sign in [1, 2][3].')).toBe(
      'Run the installer. Then sign in.',
    );
    expect(stripCitationChips('the guide [3] covers it')).toBe('the guide covers it');
  });
  it('keeps a line break before a run', () => {
    expect(stripCitationChips('Done.\n[2] Next')).toBe('Done.\n Next');
  });
  it('leaves indexing in prose untouched', () => {
    expect(stripCitationChips('read array[1] and foo[12]bar')).toBe('read array[1] and foo[12]bar');
  });
});
