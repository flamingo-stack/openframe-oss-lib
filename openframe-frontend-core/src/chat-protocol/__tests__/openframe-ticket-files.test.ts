/** The ticket receipt: its words, and the system row a thread draws as one chip. */

import { describe, expect, it } from 'vitest';
import { openFrameTicketFilesMessage, openFrameTicketFilesText } from '../openframe-ticket-files';

describe('openFrameTicketFilesText', () => {
  it('counts the files and names the ticket by its number', () => {
    expect(openFrameTicketFilesText({ attachedFileCount: 2, ticketNumber: 1003 })).toBe(
      '2 files added to ticket #1003',
    );
    expect(openFrameTicketFilesText({ attachedFileCount: 1, ticketNumber: 1002 })).toBe('1 file added to ticket #1002');
  });

  it('says "the ticket" when the number is unknown', () => {
    expect(openFrameTicketFilesText({ attachedFileCount: 3 })).toBe('3 files added to the ticket');
    expect(openFrameTicketFilesText({ attachedFileCount: 3, ticketNumber: null })).toBe('3 files added to the ticket');
  });
});

describe('openFrameTicketFilesMessage', () => {
  const now = new Date('2026-11-27T10:00:00.000Z');

  it('is a system row carrying the receipt, with the words as its text part', () => {
    const receipt = { ticketId: 't-9', ticketNumber: 1003, attachedFileCount: 2 };
    expect(openFrameTicketFilesMessage(receipt, now)).toEqual({
      id: `ticket-files-t-9-${now.getTime()}`,
      role: 'system',
      metadata: {
        createdAt: '2026-11-27T10:00:00.000Z',
        author: { authorType: 'system' },
        openframeTicketFiles: receipt,
      },
      parts: [{ type: 'text', text: '2 files added to ticket #1003' }],
    });
  });

  it('is nothing when no file was added', () => {
    expect(openFrameTicketFilesMessage({ ticketId: 't-9', attachedFileCount: 0 }, now)).toBeNull();
    expect(openFrameTicketFilesMessage({ ticketId: 't-9', attachedFileCount: -1 }, now)).toBeNull();
  });

  it('stamps the current time by default', () => {
    const message = openFrameTicketFilesMessage({ ticketId: 't-1', attachedFileCount: 1 });
    expect(message?.id).toMatch(/^ticket-files-t-1-\d+$/);
    expect(Number.isNaN(Date.parse(message?.metadata?.createdAt ?? ''))).toBe(false);
  });
});
