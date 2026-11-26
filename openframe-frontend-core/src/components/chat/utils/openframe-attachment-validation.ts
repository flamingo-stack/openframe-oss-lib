/**
 * The client's checks on files picked, dropped or pasted into an OpenFrame chat (Mingo, Fae): size, real type, and
 * the per-message and per-chat counts. The server checks again; this only spares an upload that would be refused.
 *
 * The real type is read from the file's magic bytes (`file-type`), never its extension or the browser's `type`: a
 * renamed `.exe` is an executable whatever it is called. Plain-text types have no magic bytes, so a file whose content
 * no signature matches passes only when its extension is a text type of the profile and its first bytes read as text.
 */

import { fileTypeFromBuffer } from 'file-type';
import {
  type OpenFrameAttachmentErrorCode,
  type OpenFrameAttachmentProfile,
  type OpenFrameAttachmentType,
  openFrameAllowedTypes,
  openFrameFileExtension,
} from '../../../chat-protocol/attachment-profiles';

/** The verdict on one file. `mediaType` is the real type of an accepted file. */
export type OpenFrameAttachmentCheck =
  { file: File; ok: true; mediaType: string } | { file: File; ok: false; error: OpenFrameAttachmentErrorCode };

/** How many files already count against the limits: staged in this message, and in the chat (sent and staged). */
export interface OpenFrameAttachmentCounts {
  /** Files staged in the message that are not refused. */
  messageFileCount: number;
  /** Files in the chat: the ones sent before plus the ones staged now. */
  chatFileCount: number;
}

/** How much of a file is read to decide it is text. */
const TEXT_PROBE_BYTES = 8192;

/** The file's bytes. `Blob.arrayBuffer` where the runtime has it, a `FileReader` where it does not (older webviews). */
function readBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then(buffer => new Uint8Array(buffer));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsArrayBuffer(blob);
  });
}

/** Whether the bytes read as text: no NUL byte, and valid UTF-8 (a probe cut mid-character is allowed). */
function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: true });
    return true;
  } catch {
    return false;
  }
}

/** The real type of a file among the allowed ones, or null when it is not allowed. */
async function allowedTypeOf(file: File, allowed: readonly OpenFrameAttachmentType[]): Promise<string | null> {
  const extension = openFrameFileExtension(file.name);
  // A known extension that is not allowed is refused whatever the content (a PNG renamed `.exe` stays out).
  if (extension && !allowed.some(type => type.extensions.includes(extension))) return null;

  let bytes: Uint8Array;
  try {
    bytes = await readBytes(file);
  } catch {
    return null;
  }
  const sniffed = await fileTypeFromBuffer(bytes);
  if (sniffed) {
    // A signature matched: that is the type, and it has to be on the list.
    return allowed.some(type => type.mediaType === sniffed.mime) ? sniffed.mime : null;
  }
  // No signature: only a text type of the profile, by extension, whose content reads as text.
  const textType = allowed.find(type => type.kind === 'text' && type.extensions.includes(extension));
  if (!textType || !looksLikeText(bytes.subarray(0, TEXT_PROBE_BYTES))) return null;
  return textType.mediaType;
}

/**
 * Check files against a profile, in the order given. Each accepted file takes a slot, so the 11th file of a message or
 * the 21st of a chat is refused even when every one of them is fine on its own. A file too large is refused before its
 * bytes are read.
 */
export async function validateOpenFrameAttachments(
  files: readonly File[],
  profile: OpenFrameAttachmentProfile,
  counts: OpenFrameAttachmentCounts,
): Promise<OpenFrameAttachmentCheck[]> {
  const allowed = openFrameAllowedTypes(profile);
  let inMessage = counts.messageFileCount;
  let inChat = counts.chatFileCount;
  const results: OpenFrameAttachmentCheck[] = [];
  for (const file of files) {
    if (file.size > profile.maxFileBytes) {
      results.push({ file, ok: false, error: 'TOO_LARGE' });
      continue;
    }
    const mediaType = await allowedTypeOf(file, allowed);
    if (!mediaType) {
      results.push({ file, ok: false, error: 'TYPE_NOT_ALLOWED' });
    } else if (inChat >= profile.maxFilesPerChat) {
      results.push({ file, ok: false, error: 'CHAT_LIMIT' });
    } else if (inMessage >= profile.maxFilesPerMessage) {
      results.push({ file, ok: false, error: 'MESSAGE_LIMIT' });
    } else {
      inMessage += 1;
      inChat += 1;
      results.push({ file, ok: true, mediaType });
    }
  }
  return results;
}
