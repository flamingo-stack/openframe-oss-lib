/**
 * A ticket's attachments say where a file came from beside its size ("24 KB · Added from chat"), and nothing more when
 * the host gives no source.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TicketAttachmentsList } from '../ticket-attachments-list';

describe('TicketAttachmentsList', () => {
  it('writes the source beside the size, and the size alone without one', () => {
    render(
      <TicketAttachmentsList
        attachments={[
          { id: 'a1', fileName: 'vpn-error.png', fileSize: '640 KB', sourceLabel: 'Added from chat' },
          { id: 'a2', fileName: 'invoice.pdf', fileSize: '24 KB' },
          { id: 'a3', fileName: 'notes.txt', fileSize: '', sourceLabel: 'Added from chat' },
        ]}
      />,
    );
    expect(screen.getByText('640 KB · Added from chat')).toBeTruthy();
    expect(screen.getByText('24 KB')).toBeTruthy();
    expect(screen.getByText('Added from chat')).toBeTruthy();
  });
});
