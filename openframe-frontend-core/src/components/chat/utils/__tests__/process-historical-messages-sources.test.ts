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

import type { HistoricalMessage } from '../../types';
import { processHistoricalMessages } from '../process-historical-messages';

const SOURCE = {
  index: 1,
  name: 'Install the OpenFrame Agent on Windows',
  path: 'onboarding-guides/install-the-openframe-agent-on-windows',
  documentType: 'onboarding_guide',
  id: '88dd40cc',
  sourceRepo: 'onboarding-guides',
};

/** The metadata row, as the backend persists it. */
const metadataRow = (id: string, createdAt: string): HistoricalMessage => ({
  id,
  chatType: 'ADMIN_AI_CHAT',
  createdAt,
  owner: { type: 'ASSISTANT' },
  messageData: [
    {
      type: 'GUIDE',
      payload: {
        sources: [SOURCE],
        cards: [{ ref: '[card://onboarding_guide:88dd40cc]', entityType: 'onboarding_guide', entityId: '88dd40cc' }],
      },
    },
  ],
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

describe('processHistoricalMessages — source metadata', () => {
  it('attaches a metadata row to the answer it precedes', () => {
    const { messages } = processHistoricalMessages([
      userRow('u1', '2026-08-26T09:00:00Z'),
      metadataRow('m1', '2026-08-26T09:00:01Z'),
      answerRow('a1', '2026-08-26T09:00:02Z', 'Use this guide [1].'),
    ]);

    const answer = messages[messages.length - 1];
    expect(answer.role).toBe('assistant');
    expect(answer.sources).toEqual([SOURCE]);
    expect(answer.refs).toEqual([
      {
        type: 'onboarding_guide',
        id: '88dd40cc',
        // Enriched off the matching source — the card row carries no title.
        title: SOURCE.name,
        url: null,
        sourceRepo: 'onboarding-guides',
        metadata: { path: SOURCE.path },
      },
    ]);
  });

  it('does not render a metadata-only row as its own empty bubble', () => {
    const { messages } = processHistoricalMessages([
      userRow('u1', '2026-08-26T09:00:00Z'),
      metadataRow('m1', '2026-08-26T09:00:01Z'),
      answerRow('a1', '2026-08-26T09:00:02Z', 'Answer.'),
    ]);

    expect(messages.filter(m => m.role === 'assistant')).toHaveLength(1);
  });

  it('keeps each answer’s metadata on its own answer', () => {
    // The reason this is per-message at all: two turns, two different sets.
    const secondSource = { ...SOURCE, index: 1, name: 'Configure Your Tenant Settings', id: 'other' };
    const { messages } = processHistoricalMessages([
      userRow('u1', '2026-08-26T09:00:00Z'),
      metadataRow('m1', '2026-08-26T09:00:01Z'),
      answerRow('a1', '2026-08-26T09:00:02Z', 'First answer [1].'),
      userRow('u2', '2026-08-26T09:01:00Z'),
      {
        ...metadataRow('m2', '2026-08-26T09:01:01Z'),
        messageData: [{ type: 'GUIDE', payload: { sources: [secondSource] } }],
      },
      answerRow('a2', '2026-08-26T09:01:02Z', 'Second answer [1].'),
    ]);

    const answers = messages.filter(m => m.role === 'assistant');
    expect(answers).toHaveLength(2);
    expect(answers[0].sources?.[0].name).toBe(SOURCE.name);
    expect(answers[1].sources?.[0].name).toBe(secondSource.name);
  });

  it('leaves an answer with no metadata untouched', () => {
    const { messages } = processHistoricalMessages([
      userRow('u1', '2026-08-26T09:00:00Z'),
      answerRow('a1', '2026-08-26T09:00:02Z', 'Plain answer.'),
    ]);

    const answer = messages[messages.length - 1];
    expect(answer).not.toHaveProperty('sources');
    expect(answer).not.toHaveProperty('refs');
  });

  it('unions metadata from several tool calls in one turn', () => {
    const { messages } = processHistoricalMessages([
      userRow('u1', '2026-08-26T09:00:00Z'),
      metadataRow('m1', '2026-08-26T09:00:01Z'),
      {
        ...metadataRow('m2', '2026-08-26T09:00:02Z'),
        messageData: [{ type: 'GUIDE', payload: { sources: [{ index: 2, name: 'Second tool result' }] } }],
      },
      answerRow('a1', '2026-08-26T09:00:03Z', 'Both [1] and [2].'),
    ]);

    const answer = messages[messages.length - 1];
    expect(answer.sources?.map(source => source.index)).toEqual([1, 2]);
  });
});
