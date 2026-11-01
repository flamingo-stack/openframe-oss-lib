/**
 * A stored chat row as the message the chat draws: THE one mapping for every surface that shows a saved
 * conversation, the chat's own history (`useChatHistoryHydration`) and a host's transcript viewer (the hub's admin
 * AI Chats drawer). An answer with record cards is its ordered parts (text and cards, in the order they streamed;
 * `segmentsOfParts`), never cards read out of its text, and it carries the sources it was answered from, so the
 * sources strip under it (`ChatMessageSources`) is the live answer's. A second mapping drew a transcript without its
 * cards and sources (2026-11-01).
 */

import { segmentsOfParts } from '../../chat-protocol/record-cards';
import type { ChatSource, Message } from './types/message.types';
import { AUTO_CONTINUATION_DIRECTIVE_PREFIX } from './utils/auto-continuation-directive';

/** A stored message row, as the history route and a transcript read it. */
export interface StoredChatRow {
  role?: unknown;
  content?: unknown;
  parts?: unknown;
  sources?: unknown;
  created_at?: unknown;
}

/**
 * The message a stored row draws, or null for a role the chat does not show. `id` is the message's key. A user row
 * the chat never shows (the approval placeholder, the server's auto-continuation directive) is `hidden`.
 */
export function messageFromStoredRow(row: StoredChatRow, id: string): Message | null {
  const role = row.role === 'assistant' ? 'assistant' : row.role === 'user' ? 'user' : null;
  if (!role) return null;
  const content = typeof row.content === 'string' ? row.content : '';
  const hidden = role === 'user' && (content === '' || content.startsWith(AUTO_CONTINUATION_DIRECTIVE_PREFIX));
  const parts = role === 'assistant' ? segmentsOfParts(row.parts) : null;
  const sources =
    role === 'assistant' && Array.isArray(row.sources) && row.sources.length > 0 ? (row.sources as ChatSource[]) : null;
  return {
    id,
    role,
    content: parts && parts.length > 0 ? parts : content,
    ...(typeof row.created_at === 'string' ? { timestamp: new Date(row.created_at) } : {}),
    ...(sources ? { sources } : {}),
    ...(hidden ? { hidden: true } : {}),
  };
}
