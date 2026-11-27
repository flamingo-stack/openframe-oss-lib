/**
 * The OpenFrame tray's transitions without React: staging a pick, the server's status applied, the waiting files and
 * the wait limit, the failed-read count, the ready files.
 */

import { describe, expect, it } from 'vitest';
import type { OpenFrameAttachmentItem } from '../../../../chat-protocol/attachment-profiles';
import { OpenFrameAttachmentUploadError } from '../../../../chat-protocol/attachment-uploader';
import {
  applyOpenFrameServerStatus,
  countOpenFrameStatusFailure,
  isFinalOpenFrameStatus,
  OPENFRAME_STATUS_FAILURES_ALLOWED,
  type OpenFrameTrayEntry,
  openFrameReadyAttachments,
  openFrameStagedCount,
  openFrameUploadErrorCode,
  openFrameUploadPercent,
  openFrameWaitingFiles,
  overdueOpenFrameFiles,
  stageOpenFrameChecks,
} from '../openframe-attachment-tray';

const file = (name: string) => new File(['x'], name);

const item = (id: string, extra: Partial<OpenFrameAttachmentItem> = {}): OpenFrameAttachmentItem => ({
  id,
  name: `${id}.png`,
  size: 1,
  state: 'scanning',
  ...extra,
});

describe('stageOpenFrameChecks', () => {
  it('queues the accepted files with a preview and keeps the refused ones as errors, in pick order', () => {
    let next = 0;
    const pick = stageOpenFrameChecks(
      [
        { file: file('a.png'), ok: true, mediaType: 'image/png' },
        { file: file('b.exe'), ok: false, error: 'TYPE_NOT_ALLOWED' },
        { file: file('c.txt'), ok: true, mediaType: 'text/plain' },
      ],
      () => `f${(next += 1)}`,
      (_, mediaType) => (mediaType === 'image/png' ? 'blob:a' : undefined),
    );

    expect(pick.queued).toEqual(['f1', 'f3']);
    expect(
      pick.additions.map(({ id, state, error, progress, thumbnailUrl }) => [id, state, error, progress, thumbnailUrl]),
    ).toEqual([
      ['f1', 'uploading', undefined, 0, 'blob:a'],
      ['f2', 'error', 'TYPE_NOT_ALLOWED', undefined, undefined],
      ['f3', 'uploading', undefined, 0, undefined],
    ]);
    expect(pick.entries.map(([id, entry]) => [id, entry.mediaType])).toEqual([
      ['f1', 'image/png'],
      ['f2', undefined],
      ['f3', 'text/plain'],
    ]);
  });
});

describe('applyOpenFrameServerStatus', () => {
  const tray = [item('a', { thumbnailUrl: 'blob:local' }), item('b')];

  it('ready keeps the local picture over the server thumbnail and takes the token estimate', () => {
    const next = applyOpenFrameServerStatus(tray, 'a', {
      attachmentId: 'att_a',
      state: 'ready',
      tokenEstimate: 42,
      thumbnailUrl: 'https://server/thumb',
    });
    expect(next[0]).toMatchObject({
      state: 'ready',
      tokenEstimate: 42,
      thumbnailUrl: 'blob:local',
      progress: undefined,
    });
    expect(next[1]).toBe(tray[1]);
  });

  it('ready without a local picture takes the server thumbnail', () => {
    const next = applyOpenFrameServerStatus(tray, 'b', {
      attachmentId: 'att_b',
      state: 'ready',
      thumbnailUrl: 'https://server/thumb',
    });
    expect(next[1].thumbnailUrl).toBe('https://server/thumb');
  });

  it('ready keeps the token estimate an earlier status gave when it does not repeat it', () => {
    const scanning = applyOpenFrameServerStatus(tray, 'b', {
      attachmentId: 'att_b',
      state: 'scanning',
      tokenEstimate: 120,
    });
    const ready = applyOpenFrameServerStatus(scanning, 'b', { attachmentId: 'att_b', state: 'ready' });
    expect(ready[1]).toMatchObject({ state: 'ready', tokenEstimate: 120 });
  });

  it('blocked and failed refuse the file, failed with its own code or UPLOAD_FAILED', () => {
    expect(applyOpenFrameServerStatus(tray, 'a', { attachmentId: 'x', state: 'blocked' })[0]).toMatchObject({
      state: 'error',
      error: 'BLOCKED',
    });
    expect(
      applyOpenFrameServerStatus(tray, 'a', { attachmentId: 'x', state: 'failed', error: 'TOO_LARGE' })[0].error,
    ).toBe('TOO_LARGE');
    expect(applyOpenFrameServerStatus(tray, 'a', { attachmentId: 'x', state: 'failed' })[0].error).toBe(
      'UPLOAD_FAILED',
    );
  });

  it('a status still in progress only moves the token estimate, and returns the same tray when nothing changes', () => {
    expect(
      applyOpenFrameServerStatus(tray, 'b', { attachmentId: 'x', state: 'scanning', tokenEstimate: 7 })[1],
    ).toMatchObject({ state: 'scanning', tokenEstimate: 7 });
    expect(applyOpenFrameServerStatus(tray, 'b', { attachmentId: 'x', state: 'scanning' })).toBe(tray);
  });
});

describe('the wait for ready', () => {
  const entries = new Map<string, OpenFrameTrayEntry>([
    ['up', { file: file('up'), attachmentId: 'att_up', uploadedAt: 1_000 }],
    ['old', { file: file('old'), attachmentId: 'att_old', uploadedAt: 100 }],
    ['going', { file: file('going'), attachmentId: 'att_going' }],
    ['refused', { file: file('refused') }],
  ]);

  it('waits only on files whose bytes are up', () => {
    expect(openFrameWaitingFiles(entries).map(waiting => waiting.id)).toEqual(['up', 'old']);
  });

  it('names the files that waited longer than the limit', () => {
    expect(overdueOpenFrameFiles(openFrameWaitingFiles(entries), 1_500, 1_000)).toEqual(['old']);
    expect(overdueOpenFrameFiles(openFrameWaitingFiles(entries), 1_100, 1_000)).toEqual([]);
  });

  it('ends the wait on ready, blocked and failed only', () => {
    expect(
      ['ready', 'blocked', 'failed', 'scanning', 'uploading'].map(state =>
        isFinalOpenFrameStatus({ attachmentId: 'x', state: state as 'ready' }),
      ),
    ).toEqual([true, true, true, false, false]);
  });

  it('fails the waiting files on the third failed read in a row, then counts again', () => {
    let failures = 0;
    const verdicts: boolean[] = [];
    for (let read = 0; read < OPENFRAME_STATUS_FAILURES_ALLOWED + 1; read += 1) {
      const counted = countOpenFrameStatusFailure(failures);
      failures = counted.failures;
      verdicts.push(counted.failWaiting);
    }
    expect(verdicts).toEqual([false, false, true, false]);
    expect(failures).toBe(1);
  });
});

describe('the tray read-outs', () => {
  it('hands back the ready files with their server ids, in tray order', () => {
    const items = [
      item('a', { state: 'ready' }),
      item('b'),
      item('c', { state: 'ready' }),
      item('d', { state: 'ready' }),
    ];
    const entries = new Map<string, OpenFrameTrayEntry>([
      ['a', { file: file('a'), attachmentId: 'att_a' }],
      ['c', { file: file('c'), attachmentId: 'att_c' }],
      ['d', { file: file('d') }],
    ]);
    expect(openFrameReadyAttachments(items, entries).map(ready => ready.attachmentId)).toEqual(['att_a', 'att_c']);
  });

  it('counts staged files without the refused ones', () => {
    const items = [item('a', { state: 'error' }), item('b', { state: 'ready' }), item('c', { state: 'uploading' })];
    expect(openFrameStagedCount(items)).toBe(2);
  });

  it('shows whole percents and never 100 before the answer', () => {
    expect([0, 0.426, 0.999, 1].map(openFrameUploadPercent)).toEqual([0, 42, 99, 99]);
  });

  it('keeps an upload error code and maps anything else to UPLOAD_FAILED', () => {
    expect(openFrameUploadErrorCode(new OpenFrameAttachmentUploadError('TOO_LARGE'))).toBe('TOO_LARGE');
    expect(openFrameUploadErrorCode(new Error('network'))).toBe('UPLOAD_FAILED');
  });
});
