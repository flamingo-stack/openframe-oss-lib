/**
 * One OpenFrame upload (upload URL, then the PUT) and the queue that runs a few at once, without React.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type OpenFrameAttachmentUploader,
  OpenFrameAttachmentUploadError,
} from '../../../../chat-protocol/attachment-uploader';
import { putFileWithProgress } from '../../../../utils/put-file-with-progress';
import {
  type OpenFrameUploadHandlers,
  OpenFrameUploadQueue,
  uploadOpenFrameAttachment,
} from '../openframe-attachment-upload';

vi.mock('../../../../utils/put-file-with-progress', () => ({ putFileWithProgress: vi.fn() }));
const put = vi.mocked(putFileWithProgress);

const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });

function uploader(createUpload: OpenFrameAttachmentUploader['createUpload']): OpenFrameAttachmentUploader {
  return { createUpload, getStatuses: vi.fn() };
}

const target = () =>
  Promise.resolve({ attachmentId: 'att_1', uploadUrl: 'https://storage.test/1', uploadHeaders: { a: 'b' } });

function handlers() {
  return {
    onProgress: vi.fn<OpenFrameUploadHandlers['onProgress']>(),
    onUploaded: vi.fn<OpenFrameUploadHandlers['onUploaded']>(),
    onFailed: vi.fn<OpenFrameUploadHandlers['onFailed']>(),
  };
}

afterEach(() => put.mockReset());

describe('uploadOpenFrameAttachment', () => {
  it('asks for the upload URL, PUTs with its headers, reports each percent once, then the server id', async () => {
    put.mockImplementation((_, __, options) => {
      for (const fraction of [0.1, 0.105, 0.5, 1]) options?.onProgress?.(fraction);
      return Promise.resolve();
    });
    const create = vi.fn(target);
    const h = handlers();

    await uploadOpenFrameAttachment(file, 'text/plain', uploader(create), new AbortController().signal, h);

    expect(create).toHaveBeenCalledWith(
      { name: 'notes.txt', mediaType: 'text/plain', size: 5 },
      expect.any(AbortSignal),
    );
    expect(put).toHaveBeenCalledWith('https://storage.test/1', file, expect.objectContaining({ headers: { a: 'b' } }));
    expect(h.onProgress.mock.calls.map(([percent]) => percent)).toEqual([10, 50, 99]);
    expect(h.onUploaded).toHaveBeenCalledWith('att_1');
    expect(h.onFailed).not.toHaveBeenCalled();
  });

  it('reports the host refusal code, and UPLOAD_FAILED for a PUT failure', async () => {
    const refused = handlers();
    await uploadOpenFrameAttachment(
      file,
      'text/plain',
      uploader(() => Promise.reject(new OpenFrameAttachmentUploadError('CHAT_LIMIT'))),
      new AbortController().signal,
      refused,
    );
    expect(refused.onFailed).toHaveBeenCalledWith('CHAT_LIMIT');

    put.mockRejectedValue(new Error('Upload failed with status 500'));
    const broken = handlers();
    await uploadOpenFrameAttachment(file, 'text/plain', uploader(target), new AbortController().signal, broken);
    expect(broken.onFailed).toHaveBeenCalledWith('UPLOAD_FAILED');
    expect(broken.onUploaded).not.toHaveBeenCalled();
  });

  it('reports nothing once cancelled, before or during the PUT', async () => {
    const early = new AbortController();
    const h = handlers();
    await uploadOpenFrameAttachment(
      file,
      'text/plain',
      uploader(() => {
        early.abort();
        return target();
      }),
      early.signal,
      h,
    );
    expect(put).not.toHaveBeenCalled();

    const late = new AbortController();
    put.mockImplementation(() => {
      late.abort();
      return Promise.reject(new Error('Upload cancelled'));
    });
    await uploadOpenFrameAttachment(file, 'text/plain', uploader(target), late.signal, h);
    expect(h.onUploaded).not.toHaveBeenCalled();
    expect(h.onFailed).not.toHaveBeenCalled();
  });
});

describe('OpenFrameUploadQueue', () => {
  function controlled() {
    const running: string[] = [];
    const finish = new Map<string, () => void>();
    const start = vi.fn(
      (id: string) =>
        new Promise<void>(resolve => {
          running.push(id);
          finish.set(id, resolve);
        }),
    );
    const add = (queue: OpenFrameUploadQueue, ids: string[]) => {
      for (const id of ids) queue.add(id, () => start(id));
    };
    return { running, finish, add };
  }

  it('runs at most the limit at once and starts the next in order as one ends', async () => {
    const { running, finish, add } = controlled();
    const queue = new OpenFrameUploadQueue(2);

    add(queue, ['a', 'b', 'c', 'd']);
    expect(running).toEqual(['a', 'b']);

    finish.get('b')?.();
    await vi.waitFor(() => expect(running).toEqual(['a', 'b', 'c']));
    finish.get('a')?.();
    await vi.waitFor(() => expect(running).toEqual(['a', 'b', 'c', 'd']));
  });

  it('never starts a removed or cleared file', async () => {
    const { running, finish, add } = controlled();
    const queue = new OpenFrameUploadQueue(1);

    add(queue, ['a', 'b', 'c']);
    queue.remove('b');
    finish.get('a')?.();
    await vi.waitFor(() => expect(running).toEqual(['a', 'c']));

    add(queue, ['d']);
    queue.clear();
    finish.get('c')?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(running).toEqual(['a', 'c']);
  });
});
