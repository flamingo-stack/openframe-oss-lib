import { describe, expect, it } from 'vitest';
import { OPENFRAME_RECORD_KINDS, OPENFRAME_RECORD_TYPE, openFrameRecordKindOf } from '../openframe-record-types';
import { leadingRecordLinks } from '../record-link';

describe('OpenFrame record types', () => {
  it('every kind has one type, and the type reads back as its kind', () => {
    const types = OPENFRAME_RECORD_KINDS.map(kind => OPENFRAME_RECORD_TYPE[kind]);
    expect(new Set(types).size).toBe(types.length);
    for (const kind of OPENFRAME_RECORD_KINDS) expect(openFrameRecordKindOf(OPENFRAME_RECORD_TYPE[kind])).toBe(kind);
  });

  it('keeps the case the agent matches verbatim', () => {
    expect(OPENFRAME_RECORD_TYPE.KB_ARTICLE).toBe('kb');
    expect(OPENFRAME_RECORD_TYPE.KB_FOLDER).toBe('kbFolder');
    expect(OPENFRAME_RECORD_TYPE.SCHEDULED_SCRIPT).toBe('scheduledScript');
    expect(openFrameRecordKindOf('blog_post')).toBeUndefined();
  });
});

describe('leadingRecordLinks', () => {
  it('takes the links a prompt opens with, and leaves the ask', () => {
    const { links, rest } = leadingRecordLinks(
      '[Disk full](record://insight/i1) [MacBook](record://device/m1) Why is [it](record://device/m2) failing?',
    );
    expect(links.map(link => [link.type, link.id, link.label])).toEqual([
      ['insight', 'i1', 'Disk full'],
      ['device', 'm1', 'MacBook'],
    ]);
    expect(rest).toBe('Why is [it](record://device/m2) failing?');
  });

  it('a text that opens with words opens with no record', () => {
    expect(leadingRecordLinks('Look at [x](record://device/m1)')).toEqual({
      links: [],
      rest: 'Look at [x](record://device/m1)',
    });
  });
});
