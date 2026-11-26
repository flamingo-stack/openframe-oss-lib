/**
 * The status reads behind the OpenFrame uploads hook: one read per tick for the waiting files, and a cancel that stops
 * both the read in flight and the one booked.
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenFrameAttachmentUploader } from '../../../../chat-protocol/attachment-uploader';
import { useOpenFrameAttachmentStatusPoll } from '../use-openframe-attachment-status-poll';

function setup() {
  const getStatuses = vi.fn<OpenFrameAttachmentUploader['getStatuses']>(ids =>
    Promise.resolve(ids.map(attachmentId => ({ attachmentId, state: 'scanning' as const }))),
  );
  const uploader: OpenFrameAttachmentUploader = { createUpload: vi.fn(), getStatuses };
  const { result } = renderHook(() =>
    useOpenFrameAttachmentStatusPoll({
      waiting: () => [{ id: 'f1', attachmentId: 'att_1', uploadedAt: Date.now() }],
      uploader,
      onStatus: vi.fn(),
      onFail: vi.fn(),
      pollMs: 1000,
      maxWaitMs: 60_000,
    }),
  );
  return { poll: result.current, getStatuses };
}

describe('useOpenFrameAttachmentStatusPoll', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reads the waiting files once the booked tick comes, and books once', async () => {
    const { poll, getStatuses } = setup();
    poll.schedule();
    poll.schedule();
    await vi.advanceTimersByTimeAsync(1000);
    expect(getStatuses).toHaveBeenCalledTimes(1);
    expect(getStatuses).toHaveBeenCalledWith(['att_1'], expect.any(AbortSignal));
  });

  it('cancelRead drops a booked read, and a later schedule books a new one', async () => {
    const { poll, getStatuses } = setup();
    poll.schedule();
    poll.cancelRead();
    await vi.advanceTimersByTimeAsync(5000);
    expect(getStatuses).not.toHaveBeenCalled();

    poll.schedule();
    await vi.advanceTimersByTimeAsync(1000);
    expect(getStatuses).toHaveBeenCalledTimes(1);
  });
});
