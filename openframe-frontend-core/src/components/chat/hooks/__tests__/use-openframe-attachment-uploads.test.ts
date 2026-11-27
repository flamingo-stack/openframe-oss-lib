/**
 * The OpenFrame uploader's states: a checked file asks the host for an upload URL, goes up with progress, waits on the
 * server's status and ends ready, blocked or failed; refusals never reach the host; remove cancels; send takes the
 * ready files.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OPENFRAME_MINGO_ATTACHMENT_PROFILE,
  type OpenFrameAttachmentProfile,
} from '../../../../chat-protocol/attachment-profiles';
import {
  type OpenFrameAttachmentServerStatus,
  type OpenFrameAttachmentUploader,
  OpenFrameAttachmentUploadError,
} from '../../../../chat-protocol/attachment-uploader';
import { putFileWithProgress } from '../../../../utils/put-file-with-progress';
import { useOpenFrameAttachmentUploads } from '../use-openframe-attachment-uploads';

vi.mock('../../../../utils/put-file-with-progress', () => ({ putFileWithProgress: vi.fn() }));
const put = vi.mocked(putFileWithProgress);

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1,
]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0]);

const png = (name = 'shot.png') => new File([PNG], name, { type: 'image/png' });
const text = (name = 'notes.txt') => new File(['hello'], name, { type: 'text/plain' });

/** A host uploader whose statuses the test sets per server id. */
function fakeUploader() {
  let next = 0;
  const statuses = new Map<string, OpenFrameAttachmentServerStatus>();
  const uploader = {
    createUpload: vi.fn<OpenFrameAttachmentUploader['createUpload']>(() => {
      next += 1;
      return Promise.resolve({
        attachmentId: `att_${next}`,
        uploadUrl: `https://storage.test/${next}`,
        uploadHeaders: { a: 'b' },
      });
    }),
    completeUpload: vi.fn<OpenFrameAttachmentUploader['completeUpload']>(() => Promise.resolve()),
    getStatuses: vi.fn<OpenFrameAttachmentUploader['getStatuses']>(ids =>
      Promise.resolve(ids.map(id => statuses.get(id) ?? { attachmentId: id, state: 'scanning' })),
    ),
  };
  const setStatus = (status: OpenFrameAttachmentServerStatus) => statuses.set(status.attachmentId, status);
  return { uploader, setStatus };
}

function setup(
  uploader: OpenFrameAttachmentUploader,
  options: { profile?: OpenFrameAttachmentProfile; chatFileCount?: number; statusMaxWaitMs?: number } = {},
) {
  return renderHook(() =>
    useOpenFrameAttachmentUploads({
      profile: options.profile ?? OPENFRAME_MINGO_ATTACHMENT_PROFILE,
      uploader,
      chatFileCount: options.chatFileCount ?? 0,
      statusPollMs: 5,
      statusMaxWaitMs: options.statusMaxWaitMs,
    }),
  );
}

beforeEach(() => {
  put.mockReset();
  put.mockResolvedValue(undefined);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useOpenFrameAttachmentUploads', () => {
  it('takes a checked file through uploading and scanning to ready, with its token estimate', async () => {
    const { uploader, setStatus } = fakeUploader();
    let finishPut: () => void = () => {};
    put.mockImplementation((_url, _file, options) => {
      options?.onProgress?.(0.42);
      return new Promise(resolve => {
        finishPut = () => resolve();
      });
    });
    const { result } = setup(uploader);

    act(() => result.current.addFiles([png()]));
    await waitFor(() => expect(result.current.items[0]?.progress).toBe(42));
    expect(result.current.items[0]).toMatchObject({
      state: 'uploading',
      mediaType: 'image/png',
      thumbnailUrl: 'blob:preview',
    });
    expect(uploader.createUpload).toHaveBeenCalledWith(
      { name: 'shot.png', mediaType: 'image/png', size: PNG.length },
      expect.any(AbortSignal),
    );
    expect(put).toHaveBeenCalledWith(
      'https://storage.test/1',
      expect.any(File),
      expect.objectContaining({ headers: { a: 'b' } }),
    );
    expect(result.current.pending).toBe(true);
    expect(uploader.completeUpload).not.toHaveBeenCalled();

    act(() => finishPut());
    await waitFor(() => expect(result.current.items[0]?.state).toBe('scanning'));
    expect(uploader.completeUpload).toHaveBeenCalledWith('att_1', expect.any(AbortSignal));
    await waitFor(() => expect(uploader.getStatuses).toHaveBeenCalledWith(['att_1'], expect.any(AbortSignal)));

    setStatus({ attachmentId: 'att_1', state: 'ready', tokenEstimate: 2600 });
    await waitFor(() => expect(result.current.items[0]?.state).toBe('ready'));
    expect(result.current.items[0]).toMatchObject({ tokenEstimate: 2600, thumbnailUrl: 'blob:preview' });
    expect(result.current.ready.map(r => r.attachmentId)).toEqual(['att_1']);
    expect(result.current.pending).toBe(false);
  });

  it('refuses a file the checks reject without asking the host', async () => {
    const { uploader } = fakeUploader();
    const { result } = setup(uploader);
    act(() => result.current.addFiles([new File([EXE], 'setup.exe')]));
    await waitFor(() => expect(result.current.items[0]?.state).toBe('error'));
    expect(result.current.items[0]?.error).toBe('TYPE_NOT_ALLOWED');
    expect(uploader.createUpload).not.toHaveBeenCalled();
  });

  it('shows the code the host names, and UPLOAD_FAILED for anything else', async () => {
    const { uploader } = fakeUploader();
    uploader.createUpload
      .mockRejectedValueOnce(new OpenFrameAttachmentUploadError('CHAT_LIMIT'))
      .mockRejectedValueOnce(new Error('500'));
    const { result } = setup(uploader);
    act(() => result.current.addFiles([text('a.txt'), text('b.txt')]));
    await waitFor(() => expect(result.current.items.map(i => i.error)).toEqual(['CHAT_LIMIT', 'UPLOAD_FAILED']));
  });

  it('fails a file whose PUT fails', async () => {
    const { uploader } = fakeUploader();
    put.mockRejectedValueOnce(new Error('Upload failed with status 403'));
    const { result } = setup(uploader);
    act(() => result.current.addFiles([text()]));
    await waitFor(() => expect(result.current.items[0]?.error).toBe('UPLOAD_FAILED'));
    expect(uploader.getStatuses).not.toHaveBeenCalled();
  });

  it('shows a blocked file as BLOCKED and a failed one with the server code', async () => {
    const { uploader, setStatus } = fakeUploader();
    setStatus({ attachmentId: 'att_1', state: 'blocked' });
    setStatus({ attachmentId: 'att_2', state: 'failed', error: 'TYPE_NOT_ALLOWED' });
    const { result } = setup(uploader);
    act(() => result.current.addFiles([text('a.txt'), text('b.txt')]));
    await waitFor(() => expect(result.current.items.map(i => i.error)).toEqual(['BLOCKED', 'TYPE_NOT_ALLOWED']));
    expect(result.current.ready).toEqual([]);
  });

  it('fails the waiting files after three status reads fail in a row', async () => {
    const { uploader } = fakeUploader();
    uploader.getStatuses.mockRejectedValue(new Error('network'));
    const { result } = setup(uploader);
    act(() => result.current.addFiles([text()]));
    await waitFor(() => expect(result.current.items[0]?.error).toBe('UPLOAD_FAILED'));
    expect(uploader.getStatuses).toHaveBeenCalledTimes(3);
  });

  it('fails a file the server never finishes checking', async () => {
    const { uploader } = fakeUploader();
    const { result } = setup(uploader, { statusMaxWaitMs: 20 });
    act(() => result.current.addFiles([text()]));
    await waitFor(() => expect(result.current.items[0]?.error).toBe('UPLOAD_FAILED'));
  });

  it('never asks about a file again once it failed for taking too long, so a late ready cannot revive it', async () => {
    const { uploader, setStatus } = fakeUploader();
    const { result } = setup(uploader, { statusMaxWaitMs: 20 });
    act(() => result.current.addFiles([text()]));
    await waitFor(() => expect(result.current.items[0]?.error).toBe('UPLOAD_FAILED'));
    const askedBefore = uploader.getStatuses.mock.calls.length;
    setStatus({ attachmentId: 'att_1', state: 'ready' });
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(uploader.getStatuses.mock.calls.slice(askedBefore).flatMap(([ids]) => [...ids])).not.toContain('att_1');
    expect(result.current.items[0]).toMatchObject({ state: 'error', error: 'UPLOAD_FAILED' });
  });

  it('cancels an upload when its file is removed', async () => {
    const { uploader } = fakeUploader();
    let signal: AbortSignal | undefined;
    put.mockImplementation((_url, _file, options) => {
      signal = options?.signal;
      return new Promise(() => {});
    });
    const { result } = setup(uploader);
    act(() => result.current.addFiles([png()]));
    await waitFor(() => expect(signal).toBeDefined());
    act(() => result.current.remove(result.current.items[0]?.id ?? ''));
    expect(signal?.aborted).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('uploads three files at a time', async () => {
    const { uploader } = fakeUploader();
    put.mockImplementation(() => new Promise(() => {}));
    const { result } = setup(uploader);
    act(() => result.current.addFiles([text('1.txt'), text('2.txt'), text('3.txt'), text('4.txt')]));
    await waitFor(() => expect(uploader.createUpload).toHaveBeenCalledTimes(3));
    expect(result.current.items).toHaveLength(4);
    expect(result.current.items.every(i => i.state === 'uploading')).toBe(true);
  });

  it('counts the files of an earlier pick against the message limit', async () => {
    const { uploader } = fakeUploader();
    const profile = { ...OPENFRAME_MINGO_ATTACHMENT_PROFILE, maxFilesPerMessage: 1 };
    const { result } = setup(uploader, { profile });
    act(() => {
      result.current.addFiles([text('a.txt')]);
      result.current.addFiles([text('b.txt')]);
    });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items[1]?.error).toBe('MESSAGE_LIMIT');
  });

  it('counts the files sent before against the chat limit', async () => {
    const { uploader } = fakeUploader();
    const { result } = setup(uploader, { chatFileCount: OPENFRAME_MINGO_ATTACHMENT_PROFILE.maxFilesPerChat });
    act(() => result.current.addFiles([text()]));
    await waitFor(() => expect(result.current.items[0]?.error).toBe('CHAT_LIMIT'));
  });

  it('hands the ready files to the send and empties the tray', async () => {
    const { uploader, setStatus } = fakeUploader();
    setStatus({ attachmentId: 'att_1', state: 'ready' });
    const { result } = setup(uploader);
    act(() => result.current.addFiles([text('ok.txt'), new File([EXE], 'bad.exe')]));
    await waitFor(() => expect(result.current.items[0]?.state).toBe('ready'));
    let taken: ReturnType<typeof result.current.takeForSend> = [];
    act(() => {
      taken = result.current.takeForSend();
    });
    expect(taken.map(t => [t.attachmentId, t.item.name])).toEqual([['att_1', 'ok.txt']]);
    expect(result.current.items).toEqual([]);
  });

  it('puts the files of a failed send back, ready, and sends them again', async () => {
    const { uploader, setStatus } = fakeUploader();
    setStatus({ attachmentId: 'att_1', state: 'ready', tokenEstimate: 7 });
    const { result } = setup(uploader);
    act(() => result.current.addFiles([text('ok.txt')]));
    await waitFor(() => expect(result.current.items[0]?.state).toBe('ready'));
    act(() => {
      result.current.takeForSend();
    });
    expect(result.current.items).toEqual([]);

    act(() => result.current.restore([{ id: 'att_1', name: 'ok.txt', mediaType: 'text/plain', size: 5 }]));
    expect(result.current.items).toEqual([
      expect.objectContaining({ name: 'ok.txt', state: 'ready', tokenEstimate: 7 }),
    ]);
    act(() => result.current.restore([{ id: 'att_1', name: 'ok.txt', mediaType: 'text/plain' }]));
    expect(result.current.items).toHaveLength(1);

    let again: ReturnType<typeof result.current.takeForSend> = [];
    act(() => {
      again = result.current.takeForSend();
    });
    expect(again.map(t => t.attachmentId)).toEqual(['att_1']);
  });

  it('ignores files it did not take for the last send', () => {
    const { uploader } = fakeUploader();
    const { result } = setup(uploader);
    act(() => result.current.restore([{ id: 'att_9', name: 'x.txt', mediaType: 'text/plain' }]));
    expect(result.current.items).toEqual([]);
  });

  it('cancels everything on unmount', async () => {
    const { uploader } = fakeUploader();
    let signal: AbortSignal | undefined;
    put.mockImplementation((_url, _file, options) => {
      signal = options?.signal;
      return new Promise(() => {});
    });
    const { result, unmount } = setup(uploader);
    act(() => result.current.addFiles([png()]));
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal?.aborted).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
});
