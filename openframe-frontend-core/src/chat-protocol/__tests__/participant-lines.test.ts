import { describe, expect, it } from 'vitest';
import { participantLineOf, participantLinesOfRow } from '../participant-lines';

describe('participantLineOf', () => {
  it("reads a person's line with its sequence, and a technician's name", () => {
    expect(
      participantLineOf({
        type: 'DIRECT_MESSAGE',
        text: 'On it',
        ownerType: 'ADMIN',
        displayName: 'Ann',
        streamSeq: 4,
      }),
    ).toEqual({
      author: 'technician',
      text: 'On it',
      name: 'Ann',
      seq: 4,
    });
    expect(participantLineOf({ type: 'DIRECT_MESSAGE', text: 'Thanks', ownerType: 'CLIENT' })).toEqual({
      author: 'user',
      text: 'Thanks',
    });
  });

  it("an assistant's turn is no line", () => {
    expect(participantLineOf({ type: 'TEXT', text: 'Hello', streamSeq: 1 })).toBeNull();
    expect(participantLineOf({ type: 'MESSAGE_START' })).toBeNull();
  });
});

describe('participantLinesOfRow', () => {
  it('reads TEXT by its owner and SYSTEM as a notice, with the row sequence', () => {
    expect(
      participantLinesOfRow({
        id: 'm',
        createdAt: '2026-11-04T10:00:00Z',
        lastChunkStreamSeq: 9,
        owner: { type: 'ADMIN', user: { id: 'u', firstName: 'Ann', lastName: 'Lee' } },
        parts: [
          { type: 'TEXT', text: 'Restarting now' },
          { type: 'SYSTEM', text: 'Ann joined' },
        ],
      }),
    ).toEqual([
      { author: 'technician', text: 'Restarting now', name: 'Ann Lee', seq: 9 },
      { author: 'system', text: 'Ann joined', seq: 9 },
    ]);
  });
});
