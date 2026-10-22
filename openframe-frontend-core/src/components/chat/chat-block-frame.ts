/**
 * THE frame of a box inside a chat thread (an approval, a tool run, an offer):
 * an 8px-radius card on the page surface with a hairline, padded 12px. One
 * constant, so every in-thread box is the same box and the thread reads as one
 * list of cards rather than a mix of surfaces.
 */
export const CHAT_BLOCK_FRAME_CLASS = 'rounded-lg border border-ods-border bg-ods-bg';

/** The frame with its standard padding and row gap. */
export const CHAT_BLOCK_CLASS = `${CHAT_BLOCK_FRAME_CLASS} flex flex-col gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-sf)]`;
