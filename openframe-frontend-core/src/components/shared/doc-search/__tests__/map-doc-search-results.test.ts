/**
 * The search bar folds the financial tables into one row each, titled with the
 * SHARED table label and count (the same owners the chat's grouped chip uses).
 * It used to carry its own label map; this pins that every table it folds has a
 * real label in the shared one, so a title can never decay to a raw table slug.
 */

import { describe, expect, it } from 'vitest';

import { SOURCE_LABELS_BY_TABLE } from '../../../../utils/source-icons';
import { mapDocSearchResults } from '../map-doc-search-results';
import type { DocSearchResult } from '../types';

const FOLDED_TABLES = [
  'financial-cap-table',
  'financial-kpis',
  'financial-pnl',
  'financial-balance-sheet',
  'financial-cash-flow',
];

const row = (sourceRepo: string, n: number): DocSearchResult =>
  ({
    path: `${sourceRepo}/${n}`,
    name: `Row ${n}`,
    snippet: '',
    type: 'file',
    matchType: 'content',
    documentType: 'cap_table',
    sourceRepo,
    entityId: `${n}`,
  }) as DocSearchResult;

describe('mapDocSearchResults', () => {
  it.each(FOLDED_TABLES)('titles the folded %s row with its shared label and count', table => {
    expect(SOURCE_LABELS_BY_TABLE[table]).toEqual(expect.any(String));

    const [group, ...rest] = mapDocSearchResults([row(table, 1), row(table, 2)]);
    expect(rest).toEqual([]);
    expect(group.title).toBe(`${SOURCE_LABELS_BY_TABLE[table]} (2 records)`);
    expect(group.title.startsWith(table)).toBe(false);
  });

  it('leaves every other table as one row per result', () => {
    const results = mapDocSearchResults([row('blog-posts', 1), row('blog-posts', 2)]);
    expect(results.map(result => result.title)).toEqual(['Row 1', 'Row 2']);
  });
});
