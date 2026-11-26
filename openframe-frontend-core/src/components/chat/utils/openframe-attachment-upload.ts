/**
 * The OpenFrame composer's uploads without React: one file's upload (the host's upload URL, then the PUT with
 * progress) and the queue that keeps a few of them running at once.
 */

import type { OpenFrameAttachmentErrorCode } from '../../../chat-protocol/attachment-profiles';
import type { OpenFrameAttachmentUploader } from '../../../chat-protocol/attachment-uploader';
import { putFileWithProgress } from '../../../utils/put-file-with-progress';
import { openFrameUploadErrorCode, openFrameUploadPercent } from './openframe-attachment-tray';

/** What one upload reports. Nothing is reported once its signal is aborted. */
export interface OpenFrameUploadHandlers {
  /** Whole percents, each value once. */
  onProgress: (percent: number) => void;
  /** The bytes are up and the server's checks start, under the server id the status reads and the message use. */
  onUploaded: (attachmentId: string) => void;
  onFailed: (error: OpenFrameAttachmentErrorCode) => void;
}

/** Upload one checked file. Never rejects: a failure is reported through `onFailed`. */
export async function uploadOpenFrameAttachment(
  file: File,
  mediaType: string,
  uploader: OpenFrameAttachmentUploader,
  signal: AbortSignal,
  handlers: OpenFrameUploadHandlers,
): Promise<void> {
  try {
    const target = await uploader.createUpload({ name: file.name, mediaType, size: file.size }, signal);
    if (signal.aborted) return;
    let shown = 0;
    await putFileWithProgress(target.uploadUrl, file, {
      headers: target.uploadHeaders,
      signal,
      onProgress: fraction => {
        // A render per progress event is wasted: report a percent only when it changes.
        const percent = openFrameUploadPercent(fraction);
        if (percent === shown) return;
        shown = percent;
        handlers.onProgress(percent);
      },
    });
    if (signal.aborted) return;
    handlers.onUploaded(target.attachmentId);
  } catch (err) {
    if (signal.aborted) return;
    handlers.onFailed(openFrameUploadErrorCode(err));
  }
}

/** Runs at most `limit` uploads at once, in the order they were added; the rest wait their turn. */
export class OpenFrameUploadQueue {
  private waiting: { id: string; run: () => Promise<void> }[] = [];
  private running = 0;

  constructor(private readonly limit: number) {}

  /** Line up a file's upload; `run` starts it when a slot is free. */
  add(id: string, run: () => Promise<void>): void {
    this.waiting.push({ id, run });
    this.pump();
  }

  /** Take a file out of the line (one already running is cancelled by its own signal). */
  remove(id: string): void {
    this.waiting = this.waiting.filter(queued => queued.id !== id);
  }

  clear(): void {
    this.waiting = [];
  }

  private pump(): void {
    while (this.running < this.limit && this.waiting.length > 0) {
      const next = this.waiting.shift();
      if (next === undefined) return;
      this.running += 1;
      void next.run().finally(() => {
        this.running -= 1;
        this.pump();
      });
    }
  }
}
