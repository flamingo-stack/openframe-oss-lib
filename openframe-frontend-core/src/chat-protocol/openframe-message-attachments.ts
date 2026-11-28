/**
 * The files an OpenFrame (Mingo, Fae) message carries, as the ai-agent sends them: `Message.attachments` in the history
 * and `attachments` on the live MESSAGE_REQUEST and DIRECT_MESSAGE chunks, one shape for both
 * (`ChatFileAttachment { id fileName contentType fileSize estimatedTokens }`). Read here into the thread's
 * `OpenFrameMessageAttachment`, which the message draws under its bubble.
 */

import type { OpenFrameMessageAttachment } from './attachment-profiles';
import { isRecord } from './wire-narrow';

/**
 * What the history query selects on a message for its files. Only a backend with chat attachments has the field, and a
 * document that names a field its schema lacks is refused whole, so it is asked for only on request.
 */
export const MINGO_MESSAGE_ATTACHMENTS_SELECTION = `
          attachments {
            id
            fileName
            contentType
            fileSize
            estimatedTokens
          }`;

/** The type of a file whose type the server did not say. */
const UNKNOWN_MEDIA_TYPE = 'application/octet-stream';

/**
 * A message's files from the wire, in their order. Entries without an id or a name are left out (nothing to open, nothing
 * to show). Anything but an array, or an array of none of them: `undefined`, so a message without files carries no key.
 */
export function openFrameMessageAttachmentsOf(wire: unknown): OpenFrameMessageAttachment[] | undefined {
  if (!Array.isArray(wire)) return undefined;
  const files = wire.filter(isRecord).flatMap(file => {
    const { id, fileName, contentType, fileSize } = file;
    if (typeof id !== 'string' || id === '' || typeof fileName !== 'string' || fileName === '') return [];
    return [
      {
        id,
        name: fileName,
        mediaType: typeof contentType === 'string' && contentType !== '' ? contentType : UNKNOWN_MEDIA_TYPE,
        ...(typeof fileSize === 'number' && Number.isFinite(fileSize) ? { size: fileSize } : {}),
      },
    ];
  });
  return files.length > 0 ? files : undefined;
}

/**
 * Who a user row is, for telling its copies apart: the text and the files' ids. The optimistic row, the live echo and
 * the persisted row of one send share it; two sends of the same text with different files do not. `''` for a row with
 * neither, which matches nothing.
 */
export function openFrameMessageContentKey(
  text: string,
  attachments: readonly OpenFrameMessageAttachment[] | undefined,
): string {
  const ids = attachments?.map(file => file.id).join('\u0001') ?? '';
  if (text === '' && ids === '') return '';
  return ids === '' ? text : `${text}\u0002${ids}`;
}
