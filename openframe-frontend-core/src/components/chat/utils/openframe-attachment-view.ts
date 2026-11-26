/**
 * What the OpenFrame attachment tiles and tray say: the captions, the notes under the tray, the counter, the screen
 * reader names and whether Send waits. Pure, so the copy and the gating are tested apart from the components.
 */

import {
  type OpenFrameAttachmentErrorCode,
  type OpenFrameAttachmentItem,
  type OpenFrameAttachmentProfile,
  isOpenFrameImageType,
  openFrameFileExtension,
  openFrameMaxFileMegabytes,
} from '../../../chat-protocol/attachment-profiles';
import { formatFileSize } from '../../../utils/format';

/** How many characters of the stem stay beside the extension at the end of a cut name. */
const OPENFRAME_ATTACHMENT_NAME_TAIL_STEM_CHARS = 4;

/**
 * A name split for the tile: `head` shrinks with an ellipsis at its end and `tail` never shrinks, so a name too wide for
 * the tile reads "outlook-erro…2026.png" whatever the tile's width, and a name that fits reads whole. A name too short to
 * cut has an empty tail.
 */
export function splitFileNameForTile(name: string): { head: string; tail: string } {
  const extension = openFrameFileExtension(name);
  const suffix = extension ? `.${extension}` : '';
  const stem = name.slice(0, name.length - suffix.length);
  if (stem.length <= OPENFRAME_ATTACHMENT_NAME_TAIL_STEM_CHARS * 2) return { head: name, tail: '' };
  const tailStart = stem.length - OPENFRAME_ATTACHMENT_NAME_TAIL_STEM_CHARS;
  return { head: stem.slice(0, tailStart), tail: `${stem.slice(tailStart)}${suffix}` };
}

/** A token estimate as the tile prints it: "~840", "~2.6k", "~12k". */
export function formatTokenEstimate(tokens: number): string {
  if (tokens < 1000) return `~${Math.round(tokens)}`;
  const thousands = tokens / 1000;
  const rounded = thousands < 10 ? Math.round(thousands * 10) / 10 : Math.round(thousands);
  return `~${rounded}k`;
}

/** Whether an item is drawn as a picture. */
export function isImageAttachment(item: Pick<OpenFrameAttachmentItem, 'mediaType' | 'name'>): boolean {
  if (item.mediaType) return isOpenFrameImageType(item.mediaType);
  return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(openFrameFileExtension(item.name));
}

/** A tile's error line (Figma `chat-uploaded-file`). */
export function attachmentErrorCaption(
  error: OpenFrameAttachmentErrorCode,
  profile: OpenFrameAttachmentProfile,
): string {
  const captions: Record<OpenFrameAttachmentErrorCode, string> = {
    TOO_LARGE: `Over ${openFrameMaxFileMegabytes(profile)} MB`,
    TYPE_NOT_ALLOWED: 'Format not allowed',
    CHAT_LIMIT: 'Chat limit reached',
    MESSAGE_LIMIT: 'Message limit reached',
    BLOCKED: 'Blocked by scan',
    UPLOAD_FAILED: 'Upload failed',
  };
  return captions[error];
}

/** The note under the tray for a refused file (PRD "Composer errors"). */
export function attachmentErrorNote(error: OpenFrameAttachmentErrorCode, profile: OpenFrameAttachmentProfile): string {
  const notes: Record<OpenFrameAttachmentErrorCode, string> = {
    TOO_LARGE: `Larger than ${openFrameMaxFileMegabytes(profile)} MB`,
    TYPE_NOT_ALLOWED: "This file type can't be sent",
    CHAT_LIMIT: `This chat has reached ${profile.maxFilesPerChat} files`,
    MESSAGE_LIMIT: `A message can carry up to ${profile.maxFilesPerMessage} files`,
    BLOCKED: 'Blocked by security scan',
    UPLOAD_FAILED: 'Upload failed. Remove the file and try again',
  };
  return notes[error];
}

/** The error an item stands in, or undefined when it is not refused. */
function errorOf(item: OpenFrameAttachmentItem): OpenFrameAttachmentErrorCode | undefined {
  return item.state === 'error' ? (item.error ?? 'UPLOAD_FAILED') : undefined;
}

/**
 * A tile's second line: the size, with the token estimate on a ready file where the profile shows it ("24 KB
 * (~2.6k tokens)"); the size and progress while uploading ("18 MB · 64%"); "Scanning"; or the error.
 */
export function attachmentCaption(item: OpenFrameAttachmentItem, profile: OpenFrameAttachmentProfile): string {
  const error = errorOf(item);
  if (error) return attachmentErrorCaption(error, profile);
  const size = formatFileSize(item.size);
  if (item.state === 'scanning') return 'Scanning';
  if (item.state === 'uploading') {
    return item.progress === undefined ? size : `${size} · ${Math.max(0, Math.min(100, Math.round(item.progress)))}%`;
  }
  if (profile.showTokenEstimate && item.tokenEstimate !== undefined) {
    return `${size} (${formatTokenEstimate(item.tokenEstimate)} tokens)`;
  }
  return size;
}

/** The state a screen reader hears last: "ready", "uploading 64%", "scanning", or the error. */
function spokenState(item: OpenFrameAttachmentItem, profile: OpenFrameAttachmentProfile): string {
  const error = errorOf(item);
  if (error) return attachmentErrorCaption(error, profile);
  if (item.state === 'uploading')
    return item.progress === undefined ? 'uploading' : `uploading ${Math.round(item.progress)}%`;
  return item.state;
}

/** A tile's accessible name: "outlook-error.png, image, 412 KB, ready". */
export function attachmentAccessibleName(item: OpenFrameAttachmentItem, profile: OpenFrameAttachmentProfile): string {
  const kind = isImageAttachment(item) ? 'image' : 'file';
  return `${item.name}, ${kind}, ${formatFileSize(item.size)}, ${spokenState(item, profile)}`;
}

/** "1 file" / "3 files". */
function files(count: number): string {
  return `${count} ${count === 1 ? 'file' : 'files'}`;
}

/** Whether Send waits: a file is still uploading or being scanned. */
export function isOpenFrameSendBlocked(items: readonly OpenFrameAttachmentItem[]): boolean {
  return items.some(item => item.state === 'uploading' || item.state === 'scanning');
}

/** What the tray shows around its tiles. */
export interface OpenFrameTraySummary {
  /** Files the message will carry (not refused). */
  messageCount: number;
  /** Files in the chat once it is sent: the earlier ones and these. */
  chatCount: number;
  /** "2/10 · 5/20 in chat". */
  counter: string;
  /** Files still on their way: uploading or scanning. */
  pendingCount: number;
  /** Refused files, which Send leaves out. */
  erroredCount: number;
  /** Send waits for the pending files. */
  sendBlocked: boolean;
  /** One note per refused file, in tray order. */
  errorNotes: { id: string; name: string; text: string }[];
  /** "Send is available when 2 files finish uploading and scanning." while any is pending. */
  pendingNote: string | null;
  /** "1 file won't be sent" while refused files remain. */
  leftOutNote: string | null;
}

/** The tray's counter, notes and Send gate for the items staged now and the files the chat already holds. */
export function summarizeOpenFrameTray(
  items: readonly OpenFrameAttachmentItem[],
  profile: OpenFrameAttachmentProfile,
  chatFileCount: number,
): OpenFrameTraySummary {
  const errored = items.filter(item => item.state === 'error');
  const messageCount = items.length - errored.length;
  const chatCount = chatFileCount + messageCount;
  const pendingCount = items.filter(item => item.state === 'uploading' || item.state === 'scanning').length;
  return {
    messageCount,
    chatCount,
    counter: `${messageCount}/${profile.maxFilesPerMessage} · ${chatCount}/${profile.maxFilesPerChat} in chat`,
    pendingCount,
    erroredCount: errored.length,
    sendBlocked: pendingCount > 0,
    errorNotes: errored.map(item => ({
      id: item.id,
      name: item.name,
      text: attachmentErrorNote(item.error ?? 'UPLOAD_FAILED', profile),
    })),
    pendingNote:
      pendingCount > 0
        ? `Send is available when ${files(pendingCount)} ${pendingCount === 1 ? 'finishes' : 'finish'} uploading and scanning.`
        : null,
    leftOutNote: errored.length > 0 ? `${files(errored.length)} won't be sent` : null,
  };
}

/** Files ready to go with the message: what a host attaches on Send. */
export function readyOpenFrameAttachments(items: readonly OpenFrameAttachmentItem[]): OpenFrameAttachmentItem[] {
  return items.filter(item => item.state === 'ready');
}
