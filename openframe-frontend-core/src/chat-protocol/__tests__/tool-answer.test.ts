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

function toolPart(output: unknown): ChatPart {
  return {
    type: 'dynamic-tool',
    toolName: 'list_quick_actions',
    toolCallId: 't1',
    state: 'output-available',
    input: {},
    output,
  } as ChatPart;
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

  it('draws nothing for a result that is not a structured object', () => {
    expect(toolAnswerParts('plain words')).toEqual([]);
    expect(toolAnswerParts(null)).toEqual([]);
    expect(toolAnswerParts('[1,2]')).toEqual([]);
  });
});

describe('withToolAnswer', () => {
  it('adds the result of the tool a turn ends on after its row', () => {
    const parts = [toolPart(JSON.stringify(quickActions))];
    const shown = withToolAnswer(parts);
    expect(shown[0]).toBe(parts[0]);
    expect(shown.map(part => part.type)).toEqual(['dynamic-tool', 'text', 'data-suggestions', 'text']);
  });

  it('leaves a turn the model answered in words: its tools are steps of that answer', () => {
    const parts: ChatPart[] = [toolPart(JSON.stringify(quickActions)), { type: 'text', text: 'Here you go.' }];
    expect(withToolAnswer(parts)).toBe(parts);
  });

  it('leaves a turn whose last tool has not answered', () => {
    const running = { ...toolPart(null), state: 'input-available' } as ChatPart;
    const parts = [running];
    expect(withToolAnswer(parts)).toBe(parts);
  });
});
