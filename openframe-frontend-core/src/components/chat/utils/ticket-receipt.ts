/**
 * The first message of a chat that began as a ticket rather than a conversation: nobody wrote it, so the chat does. ONE
 * copy of the text, for every chat that shows such a ticket (the Fae client, a ticket's client side in the OpenFrame web
 * app): who raised it, then the request (its subject in bold, the description on the next line, by a markdown hard break).
 */

import type { ChatMessage, ChatMessageAuthor } from '../../../chat-protocol/chat-message';

/** Where a ticket was created, as the backend's `creationSource` names it. */
export const TICKET_CREATION_SOURCE = {
  /** The end user's own request form in the Fae client. */
  FAE_FORM: 'FAE_FORM',
  /** A technician, on the dashboard, for the end user's device. */
  ADMIN_DASHBOARD: 'ADMIN_DASHBOARD',
} as const;

/** The ticket a receipt is about. */
export interface ChatTicketReceipt {
  id: string;
  creationSource?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt?: string | null;
  /** The technician who created it, for a dashboard-made ticket. */
  creatorName?: string | null;
}

/** Whether a ticket opens with a receipt: one made by a form, the user's or a technician's. */
export function ticketHasReceipt(ticket: Pick<ChatTicketReceipt, 'creationSource'> | null | undefined): boolean {
  const source = ticket?.creationSource;
  return source === TICKET_CREATION_SOURCE.FAE_FORM || source === TICKET_CREATION_SOURCE.ADMIN_DASHBOARD;
}

/** The receipt's text. */
export function ticketReceiptText(ticket: Omit<ChatTicketReceipt, 'id'>): string {
  const lead =
    ticket.creationSource === TICKET_CREATION_SOURCE.ADMIN_DASHBOARD
      ? `${ticket.creatorName || 'Your technician'} created a ticket for an issue affecting your device. We'll keep you updated here.`
      : 'Your request has been received. We will contact you shortly.';
  return [lead, '', `**${ticket.title || 'Untitled'}**  `, ticket.description || '(No description provided)'].join(
    '\n',
  );
}

/**
 * The receipt as the thread's first message, or null for a ticket that has none. Its id is the ticket's, so the same
 * ticket gives the same row (a host memoizes it: the message memo compares parts by reference).
 */
export function ticketReceiptMessage(
  ticket: ChatTicketReceipt | null | undefined,
  assistant: ChatMessageAuthor,
): ChatMessage | null {
  if (!ticket || !ticketHasReceipt(ticket)) return null;
  const createdAt = ticket.createdAt ? new Date(ticket.createdAt).toISOString() : undefined;
  return {
    id: `ticket-receipt-${ticket.id}`,
    role: 'assistant',
    metadata: { ...(createdAt !== undefined ? { createdAt } : {}), author: assistant },
    parts: [{ type: 'text', text: ticketReceiptText(ticket) }],
  };
}
