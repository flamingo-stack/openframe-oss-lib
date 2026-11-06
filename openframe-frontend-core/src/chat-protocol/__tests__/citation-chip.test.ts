import { describe, expect, it } from 'vitest';
import { citationChipRunScanner, stripCitationChips } from '../citation-chip';

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

describe('citationChipRunScanner', () => {
  it('finds each run standing apart from a word, with what precedes it', () => {
    const runs = [...'see [1][2], then array[3] and [4, 5].'.matchAll(citationChipRunScanner())].map(m => m[0].trim());
    expect(runs).toEqual(['[1][2]', '[4, 5]']);
  });
});
