/**
 * The source strip is a legend for the sentences above it, so its order is
 * READING order, not the numbering the model happened to assign. These pin that
 * — and the fallback for an answer that cited nothing at all.
 */

import { describe, expect, it } from 'vitest';

import type { ChatSource } from '../../types/message.types';
import { splitCitedSources } from '../cited-sources';

const source = (index: number): ChatSource => ({
  index,
  name: `Source ${index}`,
  path: `docs/${index}`,
  documentType: 'markdown',
});

const sources = [source(1), source(2), source(3)];

describe('splitCitedSources', () => {
  it('orders cited sources by first mention, not by number', () => {
    const { cited, uncited } = splitCitedSources(sources, 'See [3], then [1].');

    expect(cited.map(s => s.index)).toEqual([3, 1]);
    expect(uncited.map(s => s.index)).toEqual([2]);
  });

  it('places a repeated citation once, at its first mention', () => {
    const { cited } = splitCitedSources(sources, '[2] … [1] … [2] again.');
    expect(cited.map(s => s.index)).toEqual([2, 1]);
  });

  it('treats every source as uncited when the answer cited nothing', () => {
    // The caller then shows the top few as "retrieved" rather than no strip.
    const { cited, uncited } = splitCitedSources(sources, 'No citations in this answer.');

    expect(cited).toEqual([]);
    expect(uncited).toEqual(sources);
  });

  it('ignores a citation number no source claims', () => {
    const { cited, uncited } = splitCitedSources([source(1)], 'See [7] and [1].');

    expect(cited.map(s => s.index)).toEqual([1]);
    expect(uncited).toEqual([]);
  });

  it('handles an answer with no sources', () => {
    expect(splitCitedSources(undefined, '[1]')).toEqual({ cited: [], uncited: [] });
    expect(splitCitedSources([], '[1]')).toEqual({ cited: [], uncited: [] });
  });
});

describe('splitCitedSources — code is not prose', () => {
  const retrieved = [
    { index: 1, name: 'Install the agent', path: '', documentType: '' },
    { index: 2, name: 'Configure the tenant', path: '', documentType: '' },
  ];

  it('ignores array indexing inside a fenced block', () => {
    // This assistant answers with scripts, so `$hosts[1]` is common — and a
    // source marked cited by a snippet is a citation the prose never made.
    const answer = ['Run the script below.', '```powershell', '$hosts[1] | Restart-Service', '```'].join('\n');
    const { cited, uncited } = splitCitedSources(retrieved, answer);

    expect(cited).toEqual([]);
    expect(uncited).toHaveLength(2);
  });

  it('ignores an index inside an inline code span', () => {
    expect(splitCitedSources(retrieved, 'Read `argv[1]` first.').cited).toEqual([]);
  });

  it('still reads a citation that sits beside code', () => {
    const { cited } = splitCitedSources(retrieved, 'Per the guide [1], run `argv[2]`.');

    expect(cited.map(row => row.index)).toEqual([1]);
  });
});
