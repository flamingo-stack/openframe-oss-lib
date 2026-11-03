/**
 * The search bar folds the financial tables into one row each, titled with the
 * SHARED table label and count (the same owners the chat's grouped chip uses).
 * It used to carry its own label map; this pins that every table it folds has a
 * real label in the shared one, so a title can never decay to a raw table slug.
 */

import { describe, expect, it } from 'vitest';

import { defaultDocumentTypeForTableId, SOURCE_LABELS_BY_TABLE } from '../../../../utils/source-icons';
import { mapDocSearchResults } from '../map-doc-search-results';
import type { DocSearchResult } from '../types';

const FOLDED_TABLES = [
  'financial-cap-table',
  'financial-kpis',
  'financial-pnl',
  'financial-balance-sheet',
  'financial-cash-flow',
];

const row = (tableId: string, n: number): DocSearchResult => ({
  sourceId: `record://${defaultDocumentTypeForTableId(tableId)}/${n}`,
  title: `Row ${n}`,
  snippet: '',
  type: 'file',
  matchType: 'content',
});

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

  it('carries a row’s url and record URI, and a doc’s tree path, for the action to read', () => {
    const [doc] = mapDocSearchResults([
      {
        sourceId: 'record://markdown/guides%2Finstall.md',
        title: 'Install',
        url: 'https://hub.openframe.ai/knowledge-base/guides/install.md',
        snippet: 'How to install',
        type: 'file',
        matchType: 'title',
      },
    ]);
    expect(doc).toMatchObject({
      id: 'record://markdown/guides%2Finstall.md',
      title: 'Install',
      description: 'How to install',
      path: 'guides/install.md',
      metadata: {
        url: 'https://hub.openframe.ai/knowledge-base/guides/install.md',
        sourceId: 'record://markdown/guides%2Finstall.md',
      },
    });
  });

  // TODO(CU-17tkuw635xx): the old hub's doc rows have no url, and open by the tree path.
  it('keeps the tree path an old hub sends', () => {
    const [doc] = mapDocSearchResults([
      { sourceId: null, title: 'Doc', path: 'legal/doc.pdf', snippet: '', type: 'file', matchType: 'content' },
    ]);
    expect(doc).toMatchObject({ id: 'legal/doc.pdf', path: 'legal/doc.pdf' });
  });
});
