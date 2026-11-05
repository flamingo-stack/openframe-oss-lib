/**
 * A chat between people (a remote session's side chat, a ticket's direct messages) read as LINES: who wrote, what they
 * typed, and the stream sequence that identifies it. ONE reader of the live chunk and of the persisted row, for every web
 * chat that draws such a feed; a host keeps only its own row type and which lines it shows.
 */

import { OWNER_TYPE } from '../components/chat/types/chat.types';
import type { HistoricalMessage } from '../components/chat/types/message.types';
import { createMingoDecoder } from './message-decoder';

export interface ParticipantLine {
  /** The end user (CLIENT), a technician (ADMIN), or a notice of the system. */
  author: 'user' | 'technician' | 'system';
  text: string;
  /** The name a technician's line carries, when it carries one. */
  name?: string;
  /** The stream sequence of the chunk (live) or of the row's last chunk (history). */
  seq?: number;
}

function authorOf(ownerType: string | undefined): ParticipantLine['author'] | null {
  if (ownerType === OWNER_TYPE.CLIENT) return 'user';
  if (ownerType === OWNER_TYPE.ADMIN) return 'technician';
  return null;
}

/** One live chunk as a line, or null for anything that is not a person's line or a notice (an assistant's turn). */
export function participantLineOf(payload: unknown): ParticipantLine | null {
  // A person's line is whole in its chunk: nothing carries across chunks, so a decoder per chunk.
  const entry = createMingoDecoder().decode(payload);
  const chunk = entry.chunks.find(decoded => decoded.type === 'data-chat-participant');
  if (chunk?.type !== 'data-chat-participant' || !chunk.data.text) return null;
  const seq = typeof entry.seq === 'number' && entry.seq > 0 ? entry.seq : undefined;
  const at = seq !== undefined ? { seq } : {};
  if (chunk.data.kind === 'system') return { author: 'system', text: chunk.data.text, ...at };
  const author = authorOf(chunk.data.ownerType);
  if (!author) return null;
  const name = author === 'technician' ? chunk.data.displayName || undefined : undefined;
  return { author, text: chunk.data.text, ...(name ? { name } : {}), ...at };
}

/** A persisted message's lines: a TEXT entry by its owner, a SYSTEM entry as a notice. */
export function participantLinesOfRow(row: HistoricalMessage): ParticipantLine[] {
  const seq = typeof row.lastChunkStreamSeq === 'number' ? row.lastChunkStreamSeq : undefined;
  const at = seq !== undefined ? { seq } : {};
  const author = authorOf(row.owner?.type);
  const name =
    author === 'technician' ? [row.owner?.user?.firstName, row.owner?.user?.lastName].filter(Boolean).join(' ') : '';
  const lines: ParticipantLine[] = [];
  for (const part of row.parts ?? []) {
    if (part.type === 'SYSTEM' && part.text) lines.push({ author: 'system', text: part.text, ...at });
    else if (part.type === 'TEXT' && part.text && author) {
      lines.push({ author, text: part.text, ...(name ? { name } : {}), ...at });
    }
  }
  return lines;
}
