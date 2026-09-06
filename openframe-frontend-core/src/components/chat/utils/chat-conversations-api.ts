/**
 * Conversation-list wire client for the SSE/Guide chat — the ONE place the
 * `ChatRuntime.endpoints.chatConversationsUrl` contract is spelled out:
 *
 *   GET   `<base>?status=active|archived&limit=&cursor=&search=`
 *         → route-base envelope `{ data: { dialogs, nextCursor } }`
 *   PATCH `<base>/<id>`  body `{ title }`          (rename)
 *   PATCH `<base>/<id>`  body `{ archived: true }` (archive)
 *   PATCH `<base>/<id>`  body `{ archived: false }` (restore)
 *
 * Goes through `embedAuthedFetch` with its DEFAULT credentials mode — the
 * hub identifies anonymous visitors with an httpOnly cookie, and
 * `same-origin` is exactly what carries it. Never override `credentials`.
 *
 * Wire rows are mapped to `DialogItem`; the ISO `timestamp` becomes a
 * `Date` so the list's Today/Yesterday/Older grouping is deterministic.
 */

import { readServerErrorMessage } from '../../../chat-protocol/confirm-tool';
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch';
import type { DialogItem } from '../types/component.types';
import type { FetchDialogsParams, FetchDialogsResult } from '../types/unified-chat-state.types';

export type ChatConversationStatus = 'active' | 'archived';

export interface ChatConversationsApi {
  fetchDialogs(params: FetchDialogsParams & { status: ChatConversationStatus }): Promise<FetchDialogsResult>;
  renameDialog(id: string, title: string): Promise<void>;
  archiveDialog(id: string): Promise<void>;
  unarchiveDialog(id: string): Promise<void>;
}

/** Narrow one hop of an untrusted JSON body (`typeof null === 'object'`). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** route-base `successResponse` wraps in `{ data }`; tolerate a raw body too. */
function unwrapEnvelope(payload: unknown): unknown {
  return isRecord(payload) && 'data' in payload ? payload.data : payload;
}

function toDialogItem(row: unknown): DialogItem | null {
  if (!isRecord(row)) return null;
  const id = typeof row.id === 'string' ? row.id : '';
  if (!id) return null;
  const title = typeof row.title === 'string' && row.title.length > 0 ? row.title : 'Untitled chat';
  const ts = typeof row.timestamp === 'string' ? new Date(row.timestamp) : undefined;
  return {
    id,
    title,
    ...(ts && !Number.isNaN(ts.getTime()) ? { timestamp: ts } : {}),
    ...(typeof row.lastMessage === 'string' ? { lastMessage: row.lastMessage } : {}),
  };
}

async function failWith(response: Response, fallback: string): Promise<never> {
  const message = await readServerErrorMessage(response);
  throw new Error(message ?? `${fallback}: ${response.status}`);
}

export function createChatConversationsApi(baseUrl: string): ChatConversationsApi {
  const base = baseUrl.replace(/\/+$/, '');

  const patch = async (id: string, body: Record<string, unknown>, what: string): Promise<void> => {
    const response = await embedAuthedFetch(`${base}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (!response.ok) await failWith(response, `${what} failed`);
  };

  return {
    async fetchDialogs({ status, cursor, limit, search }) {
      const qs = new URLSearchParams();
      qs.set('status', status);
      if (limit !== undefined) qs.set('limit', String(limit));
      if (cursor) qs.set('cursor', cursor);
      if (search) qs.set('search', search);
      const response = await embedAuthedFetch(`${base}?${qs.toString()}`, { method: 'GET' });
      if (!response.ok) await failWith(response, 'Conversation list failed');
      const body = unwrapEnvelope(await response.json());
      const rawDialogs = isRecord(body) && Array.isArray(body.dialogs) ? body.dialogs : [];
      const dialogs = rawDialogs.map(toDialogItem).filter((d): d is DialogItem => d !== null);
      const nextCursor = isRecord(body) && typeof body.nextCursor === 'string' ? body.nextCursor : null;
      return { dialogs, nextCursor };
    },
    renameDialog: (id, title) => patch(id, { title }, 'Rename'),
    archiveDialog: id => patch(id, { archived: true }, 'Archive'),
    unarchiveDialog: id => patch(id, { archived: false }, 'Restore'),
  };
}
