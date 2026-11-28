/**
 * The ticket receipt in the thread: a system row carrying `metadata.openframeTicketFiles` draws as one centred chip, in
 * the classic and the v2 appearance, with no face, name line or time.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openFrameTicketFilesMessage } from '../../../chat-protocol/openframe-ticket-files';
import { ChatMessageEnhanced } from '../chat-message-enhanced';
import { ChatMessageList } from '../chat-message-list';
import { CHAT_APPEARANCE } from '../types/chat.types';

const receipt = { ticketId: 't-9', ticketNumber: 1003, attachedFileCount: 2 };
const text = '2 files added to ticket #1003';

describe('ticket receipt chip', () => {
  it.each([CHAT_APPEARANCE.CLASSIC, CHAT_APPEARANCE.V2])('draws one centred chip in the %s appearance', appearance => {
    const { container } = render(
      <ChatMessageEnhanced
        role="system"
        authorType="system"
        appearance={appearance}
        parts={[{ type: 'text', text }]}
        timestamp={new Date('2026-11-27T10:00:00Z')}
        openframeTicketFiles={receipt}
      />,
    );
    const row = screen.getByTestId('openframe-ticket-files-receipt');
    expect(row).toHaveClass('flex', 'justify-center');
    // The chip alone: no name line (the classic yellow line), no receipt card, no time.
    expect(screen.getByTitle(text)).toHaveTextContent(text);
    expect(container.textContent).toBe(text);
  });

  it('reads the receipt from the message metadata in the list', () => {
    const message = openFrameTicketFilesMessage(receipt, new Date('2026-11-27T10:00:00Z'));
    if (!message) throw new Error('expected a receipt row');
    render(<ChatMessageList messages={[message]} />);
    expect(screen.getByTestId('openframe-ticket-files-receipt')).toHaveTextContent(text);
  });

  it('leaves any other system row as it was', () => {
    render(<ChatMessageEnhanced role="system" authorType="system" parts={[{ type: 'text', text: 'Alex joined' }]} />);
    expect(screen.queryByTestId('openframe-ticket-files-receipt')).toBeNull();
    expect(screen.getByText('Alex joined')).toBeInTheDocument();
  });
});
