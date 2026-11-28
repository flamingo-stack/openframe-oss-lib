/**
 * The receipt a thread shows after an OpenFrame (Fae) chat's files were added to a ticket: one system row, drawn as a
 * centred chip ("2 FILES ADDED TO TICKET #1003"). The row's text part says the same, so a renderer that does not know
 * the receipt still shows something meaningful.
 *
 * Server-safe: no React, no browser APIs.
 */

import type { ChatMessage, OpenFrameTicketFilesReceipt } from './chat-message';

/** "2 files added to ticket #1003", "1 file added to ticket #1002", "3 files added to the ticket" (no number). */
export function openFrameTicketFilesText({
  attachedFileCount,
  ticketNumber,
}: Pick<OpenFrameTicketFilesReceipt, 'attachedFileCount' | 'ticketNumber'>): string {
  const files = `${attachedFileCount} ${attachedFileCount === 1 ? 'file' : 'files'}`;
  const ticket = ticketNumber != null ? `ticket #${ticketNumber}` : 'the ticket';
  return `${files} added to ${ticket}`;
}

/** The receipt as a system row for the thread, or null when no file was added. */
export function openFrameTicketFilesMessage(
  receipt: OpenFrameTicketFilesReceipt,
  now: Date = new Date(),
): ChatMessage | null {
  if (receipt.attachedFileCount <= 0) return null;
  return {
    id: `ticket-files-${receipt.ticketId}-${now.getTime()}`,
    role: 'system',
    metadata: {
      createdAt: now.toISOString(),
      author: { authorType: 'system' },
      openframeTicketFiles: receipt,
    },
    parts: [{ type: 'text', text: openFrameTicketFilesText(receipt) }],
  };
}
