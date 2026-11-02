/**
 * Source metadata through the HISTORY path.
 *
 * The backend persists an answer's metadata as its OWN row, written when the
 * remote tool returns — so it arrives as a separate history message, BEFORE the
 * answer text, and has to end up on the answer anyway. These pin that regrouping,
 * because the failure it prevents is invisible in the live thread and only shows
 * up on reload: the chips are simply gone.
 */

import { describe, expect, it } from 'vitest';

import { isSourcePart, textOfParts, type ChatMessage } from '../../../../chat-protocol/chat-message';
import type { HistoricalMessage } from '../../types';
import { processHistoricalMessages } from '../process-historical-messages';

const SOURCE = {
  sourceId: 'record://onboarding_guide/88dd40cc',
  url: 'https://www.flamingo.run/onboarding-guides/install-the-openframe-agent-on-windows',
  title: 'Install the OpenFrame Agent on Windows',
};

const SOURCE_PART = { type: 'source-url', ...SOURCE };

/** The metadata row, as the backend persists it. */
const metadataRow = (id: string, createdAt: string, sources: unknown[] = [SOURCE]): HistoricalMessage => ({
  id,
  chatType: 'ADMIN_AI_CHAT',
  createdAt,
  owner: { type: 'ASSISTANT' },
  messageData: [{ type: 'ATTACHMENTS', sources }],
});

const answerRow = (id: string, createdAt: string, text: string): HistoricalMessage => ({
  id,
  chatType: 'ADMIN_AI_CHAT',
  createdAt,
  owner: { type: 'ASSISTANT' },
  messageData: [{ type: 'TEXT', text }],
});

const userRow = (id: string, createdAt: string): HistoricalMessage => ({
  id,
  chatType: 'ADMIN_AI_CHAT',
  createdAt,
  owner: { type: 'ADMIN' },
  messageData: [{ type: 'TEXT', text: 'How do I install the agent?' }],
});

const sourcesOf = (message: ChatMessage) => message.parts.filter(isSourcePart);

describe('processHistoricalMessages — source metadata', () => {
  it('attaches a metadata row to the answer it precedes', () => {
    const { messages } = processHistoricalMessages([
      userRow('u1', '2026-08-26T09:00:00Z'),
      metadataRow('m1', '2026-08-26T09:00:01Z'),
      answerRow('a1', '2026-08-26T09:00:02Z', 'Use this guide.'),
    ]);

    const answer = messages[messages.length - 1];
    expect(answer.role).toBe('assistant');
    expect(sourcesOf(answer)).toEqual([SOURCE_PART]);
    expect(textOfParts(answer.parts)).toBe('Use this guide.');
  });

  it('does not render a metadata-only row as its own empty bubble', () => {
    const { messages } = processHistoricalMessages([
      userRow('u1', '2026-08-26T09:00:00Z'),
      metadataRow('m1', '2026-08-26T09:00:01Z'),
      answerRow('a1', '2026-08-26T09:00:02Z', 'Answer.'),
    ]);

    expect(messages.filter(m => m.role === 'assistant')).toHaveLength(1);
  });

  it('a metadata row with no answer after it draws nothing', () => {
    const { messages } = processHistoricalMessages([
      userRow('u1', '2026-08-26T09:00:00Z'),
      metadataRow('m1', '2026-08-26T09:00:01Z'),
    ]);

    expect(messages.map(m => m.role)).toEqual(['user']);
  });

  it('keeps each answer’s metadata on its own answer', () => {
    // The reason this is per-message at all: two turns, two different sets.
    const second = {
      sourceId: 'record://onboarding_guide/other',
      url: 'https://www.flamingo.run/onboarding-guides/configure',
      title: 'Configure Your Tenant Settings',
    };
    const { messages } = processHistoricalMessages([
      userRow('u1', '2026-08-26T09:00:00Z'),
      metadataRow('m1', '2026-08-26T09:00:01Z'),
      answerRow('a1', '2026-08-26T09:00:02Z', 'First answer.'),
      userRow('u2', '2026-08-26T09:01:00Z'),
      metadataRow('m2', '2026-08-26T09:01:01Z', [second]),
      answerRow('a2', '2026-08-26T09:01:02Z', 'Second answer.'),
    ]);

    const answers = messages.filter(m => m.role === 'assistant');
    expect(answers).toHaveLength(2);
    expect(sourcesOf(answers[0])).toEqual([SOURCE_PART]);
    expect(sourcesOf(answers[1])).toEqual([{ type: 'source-url', ...second }]);
  });

  it('leaves an answer with no metadata untouched', () => {
    const { messages } = processHistoricalMessages([
      userRow('u1', '2026-08-26T09:00:00Z'),
      answerRow('a1', '2026-08-26T09:00:02Z', 'Plain answer.'),
    ]);

    expect(sourcesOf(messages[messages.length - 1])).toEqual([]);
  });

  it('unions metadata from several tool calls in one turn, each source once', () => {
    const second = { sourceId: 'record://faq/2', url: 'https://www.flamingo.run/faqs', title: 'Second tool result' };
    const { messages } = processHistoricalMessages([
      userRow('u1', '2026-08-26T09:00:00Z'),
      metadataRow('m1', '2026-08-26T09:00:01Z'),
      metadataRow('m2', '2026-08-26T09:00:02Z', [SOURCE, second]),
      answerRow('a1', '2026-08-26T09:00:03Z', 'Both.'),
    ]);

    const answer = messages[messages.length - 1];
    expect(sourcesOf(answer).map(source => source.sourceId)).toEqual([SOURCE.sourceId, second.sourceId]);
  });
});
