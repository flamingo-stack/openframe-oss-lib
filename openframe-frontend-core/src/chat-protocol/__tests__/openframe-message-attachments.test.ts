/**
 * The files an OpenFrame message carries, read from the wire: the history query asks for them only on request, the
 * read keeps what can be shown, and the live MESSAGE_REQUEST / DIRECT_MESSAGE chunks carry them to the reducer.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSchema, parse, validate } from 'graphql';
import { describe, expect, it } from 'vitest';
import { createMingoDecoder } from '../message-decoder';
import {
  MINGO_MESSAGES_QUERY,
  MINGO_SEND_MESSAGE_MUTATION,
  MINGO_SEND_MESSAGE_WITH_FILES_MUTATION,
  mingoMessagesQuery,
} from '../mingo-graphql';
import { openFrameMessageAttachmentsOf, openFrameMessageContentKey } from '../openframe-message-attachments';
import type { ChatParticipantChunk } from '../ui-chunks';

function subgraphSchema(sdl: string) {
  const plain = sdl.replace(/^extend schema @link\(.*\)\s*$/m, '').replace(/^(type \w+)\s*\{\s*\}/gm, '$1');
  const federation = ['key(fields: String!)', 'shareable', 'override(from: String!)']
    .map(directive => `directive @${directive} repeatable on OBJECT | FIELD_DEFINITION`)
    .join('\n');
  return buildSchema(`${federation}\n${plain}`, { assumeValidSDL: true });
}

const fixture = (name: string) => readFileSync(resolve(__dirname, `../__fixtures__/${name}`), 'utf8');

const wireFile = {
  id: 'att_1',
  fileName: 'disk.log',
  contentType: 'text/plain',
  fileSize: 2048,
  estimatedTokens: 512,
};

describe('the history query', () => {
  it('asks for the files only on request, and then against the chat attachments schema', () => {
    expect(MINGO_MESSAGES_QUERY).not.toMatch(/attachments \{/);
    expect(mingoMessagesQuery()).toBe(MINGO_MESSAGES_QUERY);

    const withFiles = mingoMessagesQuery({ attachments: true });
    expect(withFiles).toMatch(/attachments \{\s*id\s*fileName\s*contentType\s*fileSize\s*estimatedTokens\s*\}/);
    const base = fixture('ai-agent-schema.graphqls');
    const feature = fixture('ai-agent-chat-attachments-schema.graphqls');
    expect(validate(subgraphSchema(`${base}\n${feature}`), parse(withFiles)).map(error => error.message)).toEqual([]);
    expect(validate(subgraphSchema(base), parse(withFiles)).length).toBeGreaterThan(0);
  });

  it('asks for the files beside the email selections', () => {
    const both = mingoMessagesQuery({ email: true, attachments: true });
    expect(both).toMatch(/attachments \{/);
    expect(both).toMatch(/\.\.\. on EmailData \{/);
  });
});

describe('the send with files', () => {
  it("asks for the ticket's receipt against the chat attachments schema, and the plain send does not", () => {
    const base = fixture('ai-agent-schema.graphqls');
    const feature = fixture('ai-agent-chat-attachments-schema.graphqls');
    const errors = (sdl: string, document: string) =>
      validate(subgraphSchema(sdl), parse(document)).map(error => error.message);

    expect(MINGO_SEND_MESSAGE_WITH_FILES_MUTATION).toMatch(
      /ticketAttachmentReceipt \{\s*ticketId\s*ticketNumber\s*attachedFileCount\s*\}/,
    );
    expect(errors(`${base}\n${feature}`, MINGO_SEND_MESSAGE_WITH_FILES_MUTATION)).toEqual([]);
    expect(errors(base, MINGO_SEND_MESSAGE_WITH_FILES_MUTATION).length).toBeGreaterThan(0);
    expect(MINGO_SEND_MESSAGE_MUTATION).not.toMatch(/ticketAttachmentReceipt/);
    expect(errors(base, MINGO_SEND_MESSAGE_MUTATION)).toEqual([]);
  });
});

describe('openFrameMessageAttachmentsOf', () => {
  it('reads each file into what the thread draws, in order', () => {
    expect(
      openFrameMessageAttachmentsOf([wireFile, { id: 'att_2', fileName: 'shot.png', contentType: 'image/png' }]),
    ).toEqual([
      { id: 'att_1', name: 'disk.log', mediaType: 'text/plain', size: 2048 },
      { id: 'att_2', name: 'shot.png', mediaType: 'image/png' },
    ]);
  });

  it('leaves out files without an id or a name, and types an untyped file as bytes', () => {
    expect(
      openFrameMessageAttachmentsOf([
        { fileName: 'no-id.txt' },
        { id: 'att_3' },
        'junk',
        { id: 'att_4', fileName: 'blob', contentType: '', fileSize: Number.NaN },
      ]),
    ).toEqual([{ id: 'att_4', name: 'blob', mediaType: 'application/octet-stream' }]);
  });

  it('is undefined for no files at all', () => {
    expect(openFrameMessageAttachmentsOf(undefined)).toBeUndefined();
    expect(openFrameMessageAttachmentsOf(null)).toBeUndefined();
    expect(openFrameMessageAttachmentsOf([])).toBeUndefined();
    expect(openFrameMessageAttachmentsOf([{ id: '' }])).toBeUndefined();
  });
});

describe('openFrameMessageContentKey', () => {
  const file = (id: string) => ({ id, name: id, mediaType: 'text/plain' });

  it('is the text alone without files, so text rows keep their old identity', () => {
    expect(openFrameMessageContentKey('hi', undefined)).toBe('hi');
    expect(openFrameMessageContentKey('hi', [])).toBe('hi');
  });

  it('tells apart one text with different files, and gives files alone an identity', () => {
    const a = openFrameMessageContentKey('see', [file('att_1')]);
    expect(a).not.toBe(openFrameMessageContentKey('see', [file('att_2')]));
    expect(a).not.toBe('see');
    expect(openFrameMessageContentKey('', [file('att_1')])).not.toBe('');
  });

  it('is empty for neither', () => {
    expect(openFrameMessageContentKey('', undefined)).toBe('');
  });
});

describe('a live message with files', () => {
  const participantOf = (raw: unknown): ChatParticipantChunk['data'] | undefined => {
    const chunk = createMingoDecoder().decode(raw).chunks[0];
    return chunk?.type === 'data-chat-participant' ? chunk.data : undefined;
  };

  it("carries the files of the user's request, also with no text", () => {
    expect(participantOf({ type: 'MESSAGE_REQUEST', text: 'see attached', attachments: [wireFile] })).toMatchObject({
      kind: 'message-request',
      text: 'see attached',
      attachments: [{ id: 'att_1', name: 'disk.log' }],
    });
    expect(participantOf({ type: 'MESSAGE_REQUEST', attachments: [wireFile] })).toMatchObject({
      text: '',
      attachments: [{ id: 'att_1' }],
    });
  });

  it("carries a technician's direct message of files alone", () => {
    expect(participantOf({ type: 'DIRECT_MESSAGE', ownerType: 'ADMIN', attachments: [wireFile] })).toMatchObject({
      kind: 'direct-message',
      text: '',
      attachments: [{ id: 'att_1' }],
    });
  });

  it('carries no key without files, and none on a system notice', () => {
    expect(participantOf({ type: 'MESSAGE_REQUEST', text: 'hi' })).not.toHaveProperty('attachments');
    expect(participantOf({ type: 'SYSTEM', text: 'joined', attachments: [wireFile] })).not.toHaveProperty(
      'attachments',
    );
    expect(participantOf({ type: 'DIRECT_MESSAGE' })).toBeUndefined();
  });
});
