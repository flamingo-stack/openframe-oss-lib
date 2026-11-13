/**
 * A dialog with SIDES: one dialog, one thread per side, the sides drawn apart. A ticket is one: its end user's chat with
 * the assistant (`client`) and the technician's (`admin`) are two threads of the one dialog, and an approval answered or
 * a tool run on one side shows on the other (the dialog store's cross-side projections: an approval by its id, a tool's
 * run by its call id).
 *
 * The store this builds keys a thread by (dialog, side) (`chatDialogSideKey`), and names a key's other sides as its
 * siblings, so a non-delta entry landing on one side is projected onto the others, which exist before it lands and are
 * re-synced after. An engine shows one side of it (`useChatEngine({ side })`); two engines over the one store show both.
 */

import { createChatDialogStore, DEFAULT_DIALOG_SIDE, type ChatDialogSide } from '../stream/chat-dialog-store';
import type { ChatStreamReducerOptions } from '../stream/chat-stream-reducer';
import { createChatThreadStore, type ChatThreadSnapshot, type ChatThreadStore } from './chat-thread-store';

/** Between a dialog id and its side in a key: a control character, which no dialog id carries. */
const SIDE_SEPARATOR = '\u001f';

/** The thread-store key of one side of a dialog. */
export function chatDialogSideKey(dialogId: string, side: ChatDialogSide): string {
  return `${dialogId}${SIDE_SEPARATOR}${side}`;
}

/** The (dialog, side) a key names. A key that names no side is a dialog's default side. */
export function chatDialogSideOf(key: string): { dialogId: string; side: ChatDialogSide } {
  const at = key.lastIndexOf(SIDE_SEPARATOR);
  if (at === -1) return { dialogId: key, side: DEFAULT_DIALOG_SIDE };
  return { dialogId: key.slice(0, at), side: key.slice(at + SIDE_SEPARATOR.length) };
}

export interface ChatDialogSidesStoreConfig<S extends string> {
  /** Every side a dialog has: each one's thread receives what the others' entries project onto it. */
  sides: readonly S[];
  /**
   * A side's reducer options, read when its reducer is created (`chatThreadReducerOptions` builds them). Every reducer
   * of the store is built with them, a side first reached through another side's projection included.
   */
  options?: (side: S) => ChatStreamReducerOptions;
  /** Every changed snapshot, by its key, for a host that keeps its own store. */
  onSnapshot?: (key: string, snapshot: ChatThreadSnapshot) => void;
}

/** The thread store of dialogs with sides. */
export function createChatDialogSidesStore<S extends string>({
  sides,
  options,
  onSnapshot,
}: ChatDialogSidesStoreConfig<S>): ChatThreadStore<string> {
  const optionsOf = (side: string): ChatStreamReducerOptions => options?.(side as S) ?? {};
  return createChatThreadStore<string>({
    // A reducer first created by a projection, not by a key of this store, must be built with its side's options too.
    createStore: storeOptions =>
      createChatDialogStore({ ...storeOptions, defaultCreateOptions: (_dialogId, side) => optionsOf(side) }),
    identityFor: chatDialogSideOf,
    options: key => optionsOf(chatDialogSideOf(key).side),
    siblingKeys: key => {
      const { dialogId } = chatDialogSideOf(key);
      return sides.map(side => chatDialogSideKey(dialogId, side));
    },
    ...(onSnapshot ? { onSnapshot } : {}),
  });
}
