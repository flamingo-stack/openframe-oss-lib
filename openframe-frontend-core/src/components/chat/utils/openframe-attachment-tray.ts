/**
 * The OpenFrame composer tray's transitions, as pure functions over the tray's items: a file staged from its check, a
 * patch, a refusal, the server's status applied. `useOpenFrameAttachmentUploads` keeps the timers, the requests and the
 * React state, and calls these for every change, so the state machine is tested without rendering.
 *
 *   picked → checks → uploading (%) → scanning → ready
 *                 ↘ error (TOO_LARGE, TYPE_NOT_ALLOWED, MESSAGE_LIMIT, CHAT_LIMIT, BLOCKED, UPLOAD_FAILED)
 */

import type {
  OpenFrameAttachmentErrorCode,
  OpenFrameAttachmentItem,
  OpenFrameMessageAttachment,
} from '../../../chat-protocol/attachment-profiles';
import {
  type OpenFrameAttachmentServerStatus,
  OpenFrameAttachmentUploadError,
} from '../../../chat-protocol/attachment-uploader';
import type { OpenFrameAttachmentCheck } from './openframe-attachment-validation';

/** Status reads that may fail in a row before the files waiting on them fail. */
export const OPENFRAME_STATUS_FAILURES_ALLOWED = 3;

/** What the uploads hook keeps per staged file beside its tray item. */
export interface OpenFrameTrayEntry {
  file: File;
  mediaType?: string;
  attachmentId?: string;
  controller?: AbortController;
  /** When the bytes finished going up: the start of the wait for `ready`. */
  uploadedAt?: number;
}

/** A file whose bytes are up and that waits for the server's `ready`. */
export interface OpenFrameWaitingFile {
  id: string;
  attachmentId: string;
  uploadedAt: number;
}

/** A ready file, as the message carries it: the server's id and the tray's view of it. */
export interface OpenFrameReadyAttachment {
  attachmentId: string;
  item: OpenFrameAttachmentItem;
}

/** The type of a file whose type the checks did not settle. */
const UNKNOWN_MEDIA_TYPE = 'application/octet-stream';

/**
 * A ready file as the sent message carries it (`OpenFrameChatAttachments.onMessageSend`): the server's id, name, type
 * and size. Not the tile's picture: a local preview dies with the tray, the message lives on.
 */
export function openFrameSentAttachmentOf({
  attachmentId,
  item,
}: OpenFrameReadyAttachment): OpenFrameMessageAttachment {
  return { id: attachmentId, name: item.name, mediaType: item.mediaType ?? UNKNOWN_MEDIA_TYPE, size: item.size };
}

/** A pick's checks turned into tray items, the entries to keep and the files to upload, in pick order. */
export interface OpenFrameStagedPick {
  additions: OpenFrameAttachmentItem[];
  entries: [string, OpenFrameTrayEntry][];
  queued: string[];
}

export function openFrameUploadErrorCode(err: unknown): OpenFrameAttachmentErrorCode {
  return err instanceof OpenFrameAttachmentUploadError ? err.code : 'UPLOAD_FAILED';
}

/** Upload progress as whole percents, never 100 before the server answered. */
export function openFrameUploadPercent(fraction: number): number {
  return Math.min(99, Math.floor(fraction * 100));
}

/** Files that count against the limits: every staged file that is not refused. */
export function openFrameStagedCount(items: readonly OpenFrameAttachmentItem[]): number {
  return items.filter(item => item.state !== 'error').length;
}

/** Whether a file is still uploading or being checked (Send waits for it). */
export function isOpenFrameTrayPending(items: readonly OpenFrameAttachmentItem[]): boolean {
  return items.some(item => item.state === 'uploading' || item.state === 'scanning');
}

/** Turn a pick's checks into tray items. `makeId` names each file; `previewOf` makes an accepted image's picture. */
export function stageOpenFrameChecks(
  checks: readonly OpenFrameAttachmentCheck[],
  makeId: () => string,
  previewOf: (file: File, mediaType: string) => string | undefined,
): OpenFrameStagedPick {
  const staged: OpenFrameStagedPick = { additions: [], entries: [], queued: [] };
  for (const check of checks) {
    const id = makeId();
    const { file } = check;
    if (!check.ok) {
      staged.entries.push([id, { file }]);
      staged.additions.push({ id, name: file.name, size: file.size, state: 'error', error: check.error });
      continue;
    }
    staged.entries.push([id, { file, mediaType: check.mediaType }]);
    staged.queued.push(id);
    staged.additions.push({
      id,
      name: file.name,
      size: file.size,
      mediaType: check.mediaType,
      state: 'uploading',
      progress: 0,
      thumbnailUrl: previewOf(file, check.mediaType),
    });
  }
  return staged;
}

export function patchOpenFrameItem(
  items: readonly OpenFrameAttachmentItem[],
  id: string,
  update: Partial<OpenFrameAttachmentItem>,
): OpenFrameAttachmentItem[] {
  return items.map(item => (item.id === id ? { ...item, ...update } : item));
}

/** Show a file as refused. */
export function failOpenFrameItem(
  items: readonly OpenFrameAttachmentItem[],
  id: string,
  error: OpenFrameAttachmentErrorCode,
): OpenFrameAttachmentItem[] {
  return patchOpenFrameItem(items, id, { state: 'error', error, progress: undefined });
}

/** Whether a server status ends the wait for a file (ready, blocked or failed). */
export function isFinalOpenFrameStatus(status: OpenFrameAttachmentServerStatus): boolean {
  return status.state === 'ready' || status.state === 'blocked' || status.state === 'failed';
}

/**
 * Apply the server's status to a file. Ready keeps the local picture over the server's thumbnail; blocked and failed
 * refuse it; a status still in progress only updates the token estimate. Returns `items` itself when nothing changes.
 */
export function applyOpenFrameServerStatus(
  items: readonly OpenFrameAttachmentItem[],
  id: string,
  status: OpenFrameAttachmentServerStatus,
): readonly OpenFrameAttachmentItem[] {
  if (status.state === 'ready') {
    const current = items.find(item => item.id === id);
    return patchOpenFrameItem(items, id, {
      state: 'ready',
      progress: undefined,
      tokenEstimate: status.tokenEstimate,
      thumbnailUrl: current?.thumbnailUrl ?? status.thumbnailUrl,
    });
  }
  if (status.state === 'blocked') return failOpenFrameItem(items, id, 'BLOCKED');
  if (status.state === 'failed') return failOpenFrameItem(items, id, status.error ?? 'UPLOAD_FAILED');
  if (status.tokenEstimate !== undefined) return patchOpenFrameItem(items, id, { tokenEstimate: status.tokenEstimate });
  return items;
}

/** The files whose bytes are up and that wait for the server's `ready`. */
export function openFrameWaitingFiles(entries: ReadonlyMap<string, OpenFrameTrayEntry>): OpenFrameWaitingFile[] {
  return [...entries].flatMap(([id, { attachmentId, uploadedAt }]) =>
    attachmentId && uploadedAt !== undefined ? [{ id, attachmentId, uploadedAt }] : [],
  );
}

/** The waiting files that have waited longer than `maxWaitMs`. */
export function overdueOpenFrameFiles(
  waiting: readonly OpenFrameWaitingFile[],
  now: number,
  maxWaitMs: number,
): string[] {
  return waiting.filter(file => now - file.uploadedAt > maxWaitMs).map(file => file.id);
}

/** One more failed status read: the new count, and whether the waiting files fail now (the count then restarts). */
export function countOpenFrameStatusFailure(failures: number): { failures: number; failWaiting: boolean } {
  const next = failures + 1;
  return next >= OPENFRAME_STATUS_FAILURES_ALLOWED
    ? { failures: 0, failWaiting: true }
    : { failures: next, failWaiting: false };
}

/** The ready files of a tray, with their server ids, in tray order. */
export function openFrameReadyAttachments(
  items: readonly OpenFrameAttachmentItem[],
  entries: ReadonlyMap<string, OpenFrameTrayEntry>,
): OpenFrameReadyAttachment[] {
  return items.flatMap(item => {
    const attachmentId = item.state === 'ready' ? entries.get(item.id)?.attachmentId : undefined;
    return attachmentId ? [{ attachmentId, item }] : [];
  });
}
