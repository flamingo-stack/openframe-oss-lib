import { CHAT_APPEARANCE } from './types/chat.types';

/**
 * A message row's layout, read by the row and by its skeleton (`ChatMessageSkeleton`), so the two are one box.
 * The row's vertical rhythm per appearance: v2 spaces messages 16px apart (spacing-system-m), split across the two
 * neighbours' padding so blocks outside a row keep the rhythm.
 */
export const CHAT_MESSAGE_ROW_PADDING_CLASS = {
  [CHAT_APPEARANCE.CLASSIC]: 'py-[var(--spacing-system-s)]',
  [CHAT_APPEARANCE.V2]: 'py-[calc(var(--spacing-system-m)/2)]',
} as const;
/** The row's single column: the face line, then the segments. */
export const CHAT_MESSAGE_STACK_CLASS = 'grid min-w-0 grid-cols-1 gap-[var(--spacing-system-xxs)]';
/** The face line above a message (the face, the name and time where they are written). */
export const CHAT_MESSAGE_HEADER_CLASS = 'flex items-center gap-[var(--spacing-system-xs)]';
/** The segments of a message. */
export const CHAT_MESSAGE_SEGMENTS_CLASS = 'grid grid-cols-1 gap-2';
/** The row holding the user's own bubble, at the right. */
export const CHAT_MESSAGE_USER_ROW_CLASS = 'flex min-w-0 justify-end';
/** What the user said: a bubble on the right. */
export const CHAT_MESSAGE_USER_BUBBLE_CLASS =
  'min-w-0 max-w-[85%] break-words rounded-xl bg-ods-bg-active px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)] text-ods-text-primary text-h4';
/** What anyone else says: plain text across the thread's width. */
export const CHAT_MESSAGE_TEXT_CLASS = 'w-full min-w-0 break-words text-h4';
/** The speaker's face, in px (a round picture, an agent's mark). */
export const CHAT_MESSAGE_FACE_PX = 20;
