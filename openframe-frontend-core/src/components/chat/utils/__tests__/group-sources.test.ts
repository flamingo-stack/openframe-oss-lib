/**
 * A remote MCP tool result is flat, one citation per document, while the hub's
 * own chat ships entity rows already grouped. These pin the client rule that
 * makes the two strips read the same, and what it must leave alone.
 */

import { describe, expect, it } from 'vitest';

import type { ChatSource } from '../../types/message.types';
import { splitCitedSources } from '../cited-sources';
import { formatCitationIndices, groupSourcesByTable } from '../group-sources';

const task = (index: number): ChatSource => ({
  index,
  name: `Task ${index}`,
  path: `clickup-tasks/86${index}`,
  documentType: 'clickup_task',
  externalUrl: `/tasks?search=86${index}`,
  targetPlatform: 'product-hub',
  id: `86${index}`,
  sourceRepo: 'clickup-tasks',
});

const doc = (index: number): ChatSource => ({
  index,
  name: `Doc ${index}`,
  path: `guides/doc-${index}`,
  documentType: 'markdown',
  id: `doc-${index}`,
  sourceRepo: 'openframe-docs',
});

describe('groupSourcesByTable', () => {
  it('collapses rows of one table into a single chip that keeps every citation number', () => {
    const [group, ...rest] = groupSourcesByTable([task(1), task(2), task(4)]);

    expect(rest).toEqual([]);
    expect(group.name).toMatch(/\(3 records\)$/);
    expect(group.index).toBe(1);
    expect(group.sourceRepo).toBe('clickup-tasks');
    expect(group.items?.map(item => item.index)).toEqual([1, 2, 4]);
    expect(group.items?.[1]).toEqual({
      index: 2,
      id: '862',
      documentType: 'clickup_task',
      name: 'Task 2',
      externalUrl: '/tasks?search=862',
      targetPlatform: 'product-hub',
      path: 'clickup-tasks/862',
    });
  });

  it('puts the group where its first row was and leaves other tables in place', () => {
    const blog: ChatSource = { ...task(2), name: 'A post', sourceRepo: 'blog-posts', documentType: 'blog_post' };
    const grouped = groupSourcesByTable([task(1), blog, task(3)]);

    expect(grouped.map(source => source.sourceRepo)).toEqual(['clickup-tasks', 'blog-posts']);
    // A lone record keeps its own title rather than "Blog Posts (1 record)".
    expect(grouped[1]).toBe(blog);
  });

  it('never groups doc-table rows: each document is its own chip, as in the hub chat', () => {
    const docs = [doc(1), doc(2), doc(3)];
    expect(groupSourcesByTable(docs)).toEqual(docs);
  });

  it('passes a server-grouped chip through untouched', () => {
    const serverGroup: ChatSource = {
      ...task(1),
      name: 'ClickUp Tasks (2 records)',
      items: [
        { id: '861', documentType: 'clickup_task', name: 'Task 1' },
        { id: '869', documentType: 'clickup_task', name: 'Task 9' },
      ],
    };
    expect(groupSourcesByTable([serverGroup, task(2)])).toEqual([serverGroup, task(2)]);
  });

  it('leaves a row without an id or a table as its own chip', () => {
    const { id: _id, ...noId } = task(1);
    const { sourceRepo: _repo, ...noTable } = task(2);
    const sources = [noId, noTable, task(3)];
    expect(groupSourcesByTable(sources)).toEqual(sources);
  });
});

describe('splitCitedSources with grouping', () => {
  it('groups the cited and the uncited rows of one table separately', () => {
    const { cited, uncited } = splitCitedSources([task(1), task(2), task(3), task(4)], 'See [3] and [1].');

    expect(cited).toHaveLength(1);
    expect(cited[0].items?.map(item => item.index)).toEqual([3, 1]);
    expect(uncited).toHaveLength(1);
    expect(uncited[0].items?.map(item => item.index)).toEqual([2, 4]);
  });
});

describe('formatCitationIndices', () => {
  it('folds consecutive numbers into ranges', () => {
    expect(formatCitationIndices([3, 1, 2, 7, 9, 10])).toBe('1-3, 7, 9-10');
    expect(formatCitationIndices([5])).toBe('5');
  });
});
