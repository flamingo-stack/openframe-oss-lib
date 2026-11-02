/**
 * One rule draws every grouped source chip, over flat source parts. These pin the rule, the chip's shape, and what
 * grouping must leave alone.
 */

import { describe, expect, it } from 'vitest';

import type { ChatSourcePart } from '../../chat-protocol/chat-message';
import {
  DOC_TABLE_TYPES,
  formatCitationIndices,
  groupSourcesByTable,
  groupsByTable,
  recordCountLabel,
  type SourceRow,
} from '../source-grouping';

const row = (type: string, id: string, number?: number): SourceRow => ({
  type: 'source-url',
  sourceId: `record://${type}/${id}`,
  url: `https://www.flamingo.run/${type}/${id}`,
  title: `${type} ${id}`,
  ...(number !== undefined ? { number } : {}),
});

describe('groupsByTable', () => {
  it('a server gives the model every table as one result, except whole documents', () => {
    expect(groupsByTable('blog_post')).toBe(true);
    expect(groupsByTable(undefined)).toBe(true);
    for (const type of DOC_TABLE_TYPES) expect(groupsByTable(type)).toBe(false);
  });
});

describe('recordCountLabel', () => {
  it('states the count', () => {
    expect(recordCountLabel(1)).toBe('(1 record)');
    expect(recordCountLabel(14)).toBe('(14 records)');
  });
});

describe('groupSourcesByTable', () => {
  it('collapses rows of one table into a single chip that keeps every citation number', () => {
    const groups = groupSourcesByTable([row('blog_post', 'a', 1), row('blog_post', 'b', 3)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      tableId: 'blog-posts',
      label: 'Blog Posts (2 records)',
      key: 'record://blog_post/a',
    });
    expect(groups[0].rows.map(r => r.number)).toEqual([1, 3]);
  });

  it('groups a lone record too', () => {
    const [group] = groupSourcesByTable([row('blog_post', 'a')]);
    expect(group.label).toBe('Blog Posts (1 record)');
    expect(group.rows).toHaveLength(1);
  });

  it('keeps one deterministic order when tables interleave: each chip at its first row', () => {
    const groups = groupSourcesByTable([
      row('blog_post', 'a'),
      row('product_release', 'b'),
      row('blog_post', 'c'),
      row('webinar', 'd'),
      row('product_release', 'e'),
    ]);
    expect(groups.map(group => group.tableId)).toEqual(['blog-posts', 'product-releases', 'webinars']);
    expect(groups[1].rows.map(r => r.sourceId)).toEqual(['record://product_release/b', 'record://product_release/e']);
  });

  it('groups documents under their table like every other record', () => {
    const doc = (path: string): ChatSourcePart => ({
      type: 'source-url',
      sourceId: `record://markdown/${path}`,
      url: `https://x.test/${path}`,
      title: path,
    });
    const groups = groupSourcesByTable([doc('a.md'), doc('b.md')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(2);
  });

  it('a record is one row however often it arrives', () => {
    const groups = groupSourcesByTable([row('blog_post', 'a', 2), row('blog_post', 'a')]);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].number).toBe(2);
  });

  it('a type that names no table is a chip of its own, labelled by its title', () => {
    const groups = groupSourcesByTable([row('nobody_knows', 'a'), row('nobody_knows', 'b')]);
    expect(groups.map(group => group.tableId)).toEqual([null, null]);
    expect(groups.map(group => group.label)).toEqual(['nobody_knows a', 'nobody_knows b']);
  });

  it('a source whose id is no record URI still draws, on its own', () => {
    const [group] = groupSourcesByTable([{ type: 'source-url', sourceId: 'src-1', url: 'https://x.test/' }]);
    expect(group).toMatchObject({ tableId: null, label: 'src-1', key: 'src-1' });
  });
});

describe('formatCitationIndices', () => {
  it('folds consecutive numbers into ranges', () => {
    expect(formatCitationIndices([3, 1, 2, 7])).toBe('1-3, 7');
    expect(formatCitationIndices([5, 5])).toBe('5');
  });
});
