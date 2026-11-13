'use client';

/**
 * The chat's own handlers for what a record offers wherever it is shown: its card's "⋯" menu and its chip's "⋯" in a
 * sentence offer the SAME rows (`recordMenuGroups`, entity-cards/dispatch.tsx: Ask Mingo or Display, Open Details with
 * its ↗ new tab, Open in ClickUp for a task), so a chip can do everything its card can.
 *
 * - `RecordActionsProvider`: the chat's own Ask and Display handlers (the ones its cards get), for every chip below it.
 * - `MessageRecordLinkProvider`: put by the message renderer around the chip of a record link in an answer, the lib's
 *   or a host's, so `RecordChip` draws the record's "⋯" menu there, and a new-tab link anywhere else (an attached
 *   context item).
 */

import type React from 'react';
import { createContext, useContext } from 'react';
import type { ChatRef } from './chat-ref.types';

export interface RecordActionHandlers {
  /** "Ask Mingo" about a record: asks in the open conversation. */
  onDiscuss?: (ref: ChatRef) => void;
  /** "Display" a record whose card displays its document. */
  onDisplay?: (ref: ChatRef) => void;
  /**
   * A turn is running, so neither is on offer now: the record's menu shows the row disabled. Taking the row would empty the
   * "⋯" of a record with no page, and a chip without one is narrower, so its sentence would re-wrap at every turn.
   */
  held?: boolean;
}

const RecordActionsContext = createContext<RecordActionHandlers>({});

export function RecordActionsProvider({ value, children }: { value: RecordActionHandlers; children: React.ReactNode }) {
  return <RecordActionsContext.Provider value={value}>{children}</RecordActionsContext.Provider>;
}

/** The chat's Ask and Display handlers; empty outside a chat (then no chip offers them). */
export function useRecordActions(): RecordActionHandlers {
  return useContext(RecordActionsContext);
}

const MessageRecordLinkContext = createContext(false);

/** Put around the chip of a record link in an answer, so the chip offers the record's menu. */
export function MessageRecordLinkProvider({ children }: { children: React.ReactNode }) {
  return <MessageRecordLinkContext.Provider value>{children}</MessageRecordLinkContext.Provider>;
}

/** Whether this chip is a record link in an answer (the record's menu), not an attached context item (a new tab). */
export function useInMessageRecordLink(): boolean {
  return useContext(MessageRecordLinkContext);
}
