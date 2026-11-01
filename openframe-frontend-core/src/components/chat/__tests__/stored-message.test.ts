/**
 * One mapping from a stored row to the message the chat draws, for the chat's history and a transcript viewer alike.
 */
import { describe, expect, it } from 'vitest';
import { messageFromStoredRow } from '../stored-message';

describe('messageFromStoredRow', () => {
  it('draws an answer with cards as its ordered parts, with the sources it was answered from', () => {
    const message = messageFromStoredRow(
      {
        role: 'assistant',
        content: '✅ Task created.',
        parts: [
          { type: 'text', text: '✅ Task created.' },
          { type: 'RECORD_CARDS', cards: [{ entityType: 'internal_task', entityId: 't1' }] },
        ],
        sources: [{ index: 1, name: 'Tasks' }],
        created_at: '2026-11-01T12:00:00Z',
      },
      'm1',
    );
    expect(message?.content).toEqual([
      { type: 'text', text: '✅ Task created.' },
      { type: 'record_cards', cards: [{ type: 'internal_task', id: 't1' }] },
    ]);
    expect(message?.sources).toEqual([{ index: 1, name: 'Tasks' }]);
    expect(message?.timestamp).toEqual(new Date('2026-11-01T12:00:00Z'));
  });

  it('draws an answer without parts as its text, hides the approval placeholder, and skips other roles', () => {
    expect(messageFromStoredRow({ role: 'assistant', content: 'Hello.' }, 'a')?.content).toBe('Hello.');
    expect(messageFromStoredRow({ role: 'user', content: '' }, 'u')?.hidden).toBe(true);
    expect(messageFromStoredRow({ role: 'system', content: 'x' }, 's')).toBeNull();
  });
});
