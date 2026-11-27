/**
 * The help-center ticket reply holds a reply over `TICKET_TEXT_MAX_CHARS`: the composer it shares with the chat
 * (`ChatInput` `maxLength`) counts toward the cap and refuses to send over it, and a reply at the cap goes out.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { TicketReplyComposer } from '../ticket-reply-composer';
import { TICKET_TEXT_MAX_CHARS, type TicketData } from '../types';

const TICKET: TicketData = {
  id: 't-1',
  external_id: 'hs-1',
  subject: 'VPN drops',
  preview: null,
  body: null,
  status: 'open',
  pipeline_stage_label: null,
  clickup_task_id: null,
  clickup: null,
  priority: null,
  customer_emails: [],
  customer_company: null,
  customer_name: null,
  assigned_to: null,
  assignedOwner: null,
  hubspot_updated_at: '2026-11-26T10:00:00Z',
};

/** The attachment bag reads its upload endpoint from the runtime; nothing here uploads. */
const RUNTIME = {
  endpoints: { chatStreamUrl: '/chat', attachmentUploadUrl: '/upload-url' },
  navigation: { mode: 'host' },
  source: 'flamingo',
} as ChatRuntime;

function setup() {
  const onSendMessage = vi.fn().mockResolvedValue(true);
  render(
    <ChatRuntimeContext.Provider value={RUNTIME}>
      <TicketReplyComposer
        ticket={TICKET}
        busy={false}
        supportSystemDown={false}
        onSendMessage={onSendMessage}
        onClose={vi.fn()}
      />
    </ChatRuntimeContext.Provider>,
  );
  return onSendMessage;
}

const editor = () => screen.getByRole('textbox', { name: 'Type a reply…' });

/** Type the way the browser does: mutate the DOM, then fire `input` so the editor reads it back. */
function type(text: string) {
  const el = editor();
  el.textContent = text;
  fireEvent.input(el);
}

describe('TicketReplyComposer reply cap', () => {
  it('refuses a reply over the cap and names it, keeping the reply', () => {
    const onSendMessage = setup();
    type('a'.repeat(TICKET_TEXT_MAX_CHARS + 1));
    expect(screen.getByRole('status')).toHaveTextContent('Messages can be up to 5,000 characters');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    fireEvent.keyDown(editor(), { key: 'Enter' });
    expect(onSendMessage).not.toHaveBeenCalled();
    expect(editor().textContent).toHaveLength(TICKET_TEXT_MAX_CHARS + 1);
  });

  it('sends a reply at the cap', async () => {
    const onSendMessage = setup();
    const reply = 'a'.repeat(TICKET_TEXT_MAX_CHARS);
    type(reply);
    expect(screen.getByTestId('chat-input-length-note')).toHaveTextContent('5,000 / 5,000');
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(onSendMessage).toHaveBeenCalledWith({ id: 't-1', external_id: 'hs-1' }, reply, []));
  });
});
