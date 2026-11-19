import { describe, expect, it } from 'vitest';
import type { ChatPart } from '../chat-message';
import { toolAnswerParts, withToolAnswer } from '../tool-answer';

const quickActions = {
  text: 'Here is what you can ask me.',
  groups: [
    {
      label: 'Fix',
      prompts: [
        {
          label: 'Patching',
          prompt: 'Patch my fleet',
          icons: [
            { src: 'https://hub.example/api/icons/patch?theme=light', theme: 'light' },
            { src: 'https://hub.example/api/icons/patch?theme=dark', theme: 'dark' },
          ],
        },
        { label: 'Reboot' },
      ],
    },
    { label: 'Empty', prompts: [] },
  ],
  note: 'Each page has its own quick actions.',
  schemaVersion: '2.0',
};

const searchResult = {
  results: [
    { type: 'source-url', sourceId: 'record://blog_post/12', url: 'https://www.flamingo.run/blog/a', title: 'A' },
    { type: 'source-document', sourceId: 'record://hubspot_ticket_anon/48', mediaType: 'text/plain', title: 'T' },
    { type: 'source-url', sourceId: 'record://blog_post/12', url: 'https://www.flamingo.run/blog/a', title: 'A' },
    { type: 'source-url', sourceId: 'not-a-record', url: 'https://x', title: 'X' },
  ],
  totalCount: 2,
};

function toolPart(output: unknown, resultIsAnswer = true): ChatPart {
  return {
    type: 'dynamic-tool',
    toolName: 'list_quick_actions',
    toolCallId: 't1',
    state: 'output-available',
    input: {},
    output,
    ...(resultIsAnswer ? { toolMetadata: { resultIsAnswer: true } } : {}),
  };
}

describe('toolAnswerParts', () => {
  it('draws quick actions as text, chips and a note, with the icon MCP names for a dark host', () => {
    expect(toolAnswerParts(JSON.stringify(quickActions))).toEqual([
      { type: 'text', text: 'Here is what you can ask me.' },
      {
        type: 'data-suggestions',
        data: {
          groups: [
            {
              label: 'Fix',
              prompts: [
                {
                  label: 'Patching',
                  prompt: 'Patch my fleet',
                  icon: { url: 'https://hub.example/api/icons/patch?theme=dark' },
                },
                { label: 'Reboot' },
              ],
            },
          ],
        },
      },
      { type: 'text', text: 'Each page has its own quick actions.' },
    ]);
  });

  it('draws every record a result lists as a card beside its source part, once each', () => {
    expect(toolAnswerParts(searchResult)).toEqual([
      { type: 'source-url', sourceId: 'record://blog_post/12', url: 'https://www.flamingo.run/blog/a', title: 'A' },
      { type: 'source-document', sourceId: 'record://hubspot_ticket_anon/48', mediaType: 'text/plain', title: 'T' },
      { type: 'data-record-cards', data: { records: ['record://blog_post/12', 'record://hubspot_ticket_anon/48'] } },
    ]);
  });

  it('keeps text and unfamiliar provider answers visible without inventing presentation fields', () => {
    expect(toolAnswerParts('plain words')).toEqual([{ type: 'text', text: 'plain words' }]);
    expect(toolAnswerParts({ status: 'Ready' })).toEqual([{ type: 'text', text: '{\n  "status": "Ready"\n}' }]);
    expect(toolAnswerParts(null)).toEqual([]);
    expect(toolAnswerParts('[1,2]')).toEqual([{ type: 'text', text: '[1,2]' }]);
  });
});

describe('withToolAnswer', () => {
  it('draws the result of a row the server marked as the answer right after that row', () => {
    const text: ChatPart = { type: 'text', text: 'Before.' };
    const parts = [text, toolPart(JSON.stringify(quickActions))];
    const shown = withToolAnswer(parts);
    expect(shown[1]).toBe(parts[1]);
    expect(shown.map(part => part.type)).toEqual(['text', 'dynamic-tool', 'text', 'data-suggestions', 'text']);
  });

  it('leaves a row the server did not mark, even when the turn ends on it', () => {
    const parts = [toolPart(JSON.stringify(quickActions), false)];
    expect(withToolAnswer(parts)).toBe(parts);
  });

  it('leaves a marked row whose result holds nothing to draw', () => {
    const parts = [toolPart(null)];
    expect(withToolAnswer(parts)).toBe(parts);
  });

  it('does not promote a successful marked result after the turn failed', () => {
    const parts: ChatPart[] = [toolPart(quickActions), { type: 'data-error', data: { title: 'Provider unavailable' } }];
    expect(withToolAnswer(parts)).toBe(parts);
  });
});
