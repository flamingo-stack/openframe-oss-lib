/**
 * One rule and one constructor draw every grouped source chip: the hub's web
 * chat, its side-channel chips, and this chat's strip over flat MCP sources.
 * These pin the rule, the chip's shape, and what grouping must leave alone.
 */

import { describe, expect, it } from 'vitest';

import type { ChatSource } from '../../components/chat/types/message.types';
import { splitCitedSources } from '../../components/chat/utils/cited-sources';
import {
  buildGroupedSource,
  formatCitationIndices,
  groupSourcesByTable,
  groupsByTable,
  recordCountLabel,
} from '../source-grouping';

const row = (table: string, documentType: string, index: number): ChatSource => ({
  index,
  name: `${table} ${index}`,
  path: `${table}/${index}`,
  documentType,
  externalUrl: `/${table}?search=${index}`,
  targetPlatform: 'product-hub',
  id: `${index}`,
  sourceRepo: table,
});

const task = (index: number) => row('clickup-tasks-internal', 'internal_task', index);
const blog = (index: number) => row('blog-posts', 'blog_post', index);
const webinar = (index: number) => row('webinars', 'webinar', index);

const doc = (index: number): ChatSource => ({
  index,
  name: `Doc ${index}`,
  path: `guides/doc-${index}`,
  documentType: 'markdown',
  id: `doc-${index}`,
  sourceRepo: 'openframe-docs',
});

describe('groupsByTable', () => {
  it('groups every table except whole documents', () => {
    expect(groupsByTable('internal_task')).toBe(true);
    expect(groupsByTable(undefined)).toBe(true);
    expect(groupsByTable('markdown')).toBe(false);
    expect(groupsByTable('data_room_doc')).toBe(false);
  });
});

describe('buildGroupedSource', () => {
  it('names the chip by table and count, and heads it with its first row', () => {
    const chip = buildGroupedSource({
      index: 4,
      sourceRepo: 'clickup-tasks-internal',
      rows: [
        {
          id: 'a',
          documentType: 'internal_task',
          name: 'A',
          externalUrl: '/a',
          targetPlatform: 'product-hub',
          path: 'p/a',
        },
        { id: 'b', documentType: 'internal_task', name: 'B', path: null },
      ],
    });

    expect(chip).toMatchObject({
      index: 4,
      name: 'ClickUp Tasks (2 records)',
      path: 'p/a',
      documentType: 'internal_task',
      externalUrl: '/a',
      targetPlatform: 'product-hub',
      sourceRepo: 'clickup-tasks-internal',
    });
    // A row with no public URL still gets its dropdown row (Ask needs only id + type).
    expect(chip.items?.map(item => item.id)).toEqual(['a', 'b']);
  });

  it('lets a producer set the chip-level link', () => {
    const chip = buildGroupedSource({
      index: 1,
      sourceRepo: 'hubspot-tickets-self',
      rows: [{ id: '1', documentType: 'hubspot_ticket_self', name: 'T', externalUrl: '/t/1' }],
      externalUrl: '/my-tickets',
      targetPlatform: 'openframe',
    });
    expect(chip.externalUrl).toBe('/my-tickets');
    expect(chip.targetPlatform).toBe('openframe');
    expect(recordCountLabel(1)).toBe('(1 record)');
    expect(chip.name.endsWith('(1 record)')).toBe(true);
  });
});

describe('groupSourcesByTable', () => {
  it('collapses rows of one table into a single chip that keeps every citation number', () => {
    const [group, ...rest] = groupSourcesByTable([task(1), task(2), task(4)]);

    expect(rest).toEqual([]);
    expect(group.name).toBe('ClickUp Tasks (3 records)');
    expect(group.index).toBe(1);
    expect(group.items?.map(item => item.index)).toEqual([1, 2, 4]);
    expect(group.items?.[1]).toEqual({
      index: 2,
      id: '2',
      documentType: 'internal_task',
      name: 'clickup-tasks-internal 2',
      externalUrl: '/clickup-tasks-internal?search=2',
      targetPlatform: 'product-hub',
      path: 'clickup-tasks-internal/2',
    });
  });

  it('groups a lone record too, exactly as the hub web chat draws it', () => {
    const [chip] = groupSourcesByTable([blog(1)]);
    expect(chip.name).toBe('Blog Posts (1 record)');
    expect(chip.items).toHaveLength(1);
  });

  it('keeps one deterministic order when three tables interleave: each chip at its first row', () => {
    const chips = groupSourcesByTable([task(1), blog(2), webinar(3), task(4), doc(5), blog(6), webinar(7), task(8)]);

    expect(chips.map(chip => chip.sourceRepo)).toEqual([
      'clickup-tasks-internal',
      'blog-posts',
      'webinars',
      'openframe-docs',
    ]);
    // Every row lands in exactly one chip, in the order it arrived.
    expect(chips.map(chip => chip.items?.map(item => item.index) ?? [chip.index])).toEqual([
      [1, 4, 8],
      [2, 6],
      [3, 7],
      [5],
    ]);
  });

  it('never groups doc-table rows: each document is its own chip', () => {
    const docs = [doc(1), doc(2), doc(3)];
    expect(groupSourcesByTable(docs)).toEqual(docs);
  });

  it('passes a server-grouped chip through untouched', () => {
    const serverGroup = buildGroupedSource({
      index: 1,
      sourceRepo: 'clickup-tasks-internal',
      rows: [{ id: '9', documentType: 'internal_task', name: 'Task 9' }],
    });
    const [first] = groupSourcesByTable([serverGroup, doc(2)]);
    expect(first).toBe(serverGroup);
  });

  it('merges flat rows into a server-grouped chip of the same table: one chip, never two', () => {
    const serverChip = buildGroupedSource({
      index: 1,
      sourceRepo: 'clickup-tasks-internal',
      rows: [{ id: '9', documentType: 'internal_task', name: 'Task 9' }],
      externalUrl: '/admin/tasks',
      targetPlatform: 'product-hub',
    });
    // task(9) is the record already inside the chip; task(2) is new.
    const chips = groupSourcesByTable([serverChip, blog(5), task(2), task(9)]);

    expect(chips.map(chip => chip.sourceRepo)).toEqual(['clickup-tasks-internal', 'blog-posts']);
    expect(chips[0].name).toBe('ClickUp Tasks (2 records)');
    expect(chips[0].index).toBe(1);
    expect(chips[0].externalUrl).toBe('/admin/tasks');
    expect(chips[0].items?.map(item => item.id)).toEqual(['9', '2']);
    // The server's row keeps the group's number; the flat row keeps its own.
    expect(chips[0].items?.map(item => item.index)).toEqual([undefined, 2]);
  });

  it('keeps a table in ONE chip when a row has no id: it joins as an Open-only row', () => {
    const { id: _id, ...noId } = task(2);
    const chips = groupSourcesByTable([task(1), noId, task(3)]);

    expect(chips).toHaveLength(1);
    expect(chips[0].name).toBe('ClickUp Tasks (3 records)');
    expect(chips[0].items?.map(item => item.id)).toEqual(['1', '', '3']);
    expect(chips[0].items?.[1].externalUrl).toBe('/clickup-tasks-internal?search=2');
  });

  it('leaves a row that names no table as its own chip', () => {
    const { sourceRepo: _repo, ...noTable } = task(2);
    expect(groupSourcesByTable([noTable])).toEqual([noTable]);
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

describe('grouping is per message', () => {
  it('groups each answer from its own sources only: the same table in two answers is two chips', () => {
    // The strip calls this once per message with THAT message's sources. There
    // is no shared state to carry a table's rows from one answer into the next.
    const first = splitCitedSources([task(1), task(2)], 'See [1] and [2].');
    const second = splitCitedSources([task(1), blog(2)], 'See [1].');

    expect(first.cited.map(chip => chip.name)).toEqual(['ClickUp Tasks (2 records)']);
    expect(second.cited.map(chip => chip.name)).toEqual(['ClickUp Tasks (1 record)']);
    expect(second.uncited.map(chip => chip.name)).toEqual(['Blog Posts (1 record)']);
    // The inputs are never mutated, so a re-render regroups from the same flat list.
    const flat = [task(1), task(2)];
    groupSourcesByTable(flat);
    expect(flat.every(source => source.items === undefined)).toBe(true);
  });
});

describe('formatCitationIndices', () => {
  it('folds consecutive numbers into ranges', () => {
    expect(formatCitationIndices([3, 1, 2, 7, 9, 10])).toBe('1-3, 7, 9-10');
    expect(formatCitationIndices([5])).toBe('5');
  });
});
