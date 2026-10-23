/**
 * The host-rows → rendered-Message seam.
 *
 * It rebuilds field by field, so anything the upstream type gains and this step
 * is not updated for vanishes with no error anywhere: the thread still renders,
 * just missing whatever the new field carried. That has happened twice — see
 * the note on the module. These pin the fields whose loss is invisible.
 */

import { describe, expect, it } from 'vitest';

import type { UnifiedChatMessage } from '../../types/unified-chat-state.types';
import { mapHostMessage, pruneTimestampCache } from '../host-message';

const cache = () => new Map<string, Date>();

function assistantRow(fields: Partial<UnifiedChatMessage> = {}): UnifiedChatMessage {
  return { id: 'a1', role: 'assistant', content: 'Use this guide [1].', ...fields };
}

describe('mapHostMessage', () => {
  it('carries an answer’s source metadata to the renderer', () => {
    // Without this the citation strip never renders and each `[card://…]` in
    // the body falls back to being titled by its own id.
    const sources = [{ index: 1, name: 'Install the agent', path: 'docs/agent.md', documentType: 'markdown' }];
    const refs = [{ type: 'video', id: 'MdFJNoJeqZQ', title: 'Install the agent', url: null }];

    const message = mapHostMessage(assistantRow({ sources, refs }), { timestampCache: cache() });

    // By reference: the message memo compares this way.
    expect(message.sources).toBe(sources);
    expect(message.refs).toBe(refs);
  });

  it('omits empty metadata rather than stamping empty arrays', () => {
    const message = mapHostMessage(assistantRow({ sources: [], refs: [] }), { timestampCache: cache() });

    expect(message).not.toHaveProperty('sources');
    expect(message).not.toHaveProperty('refs');
  });

  it('keeps a hidden row hidden', () => {
    // A synthetic directive the model must see and the reader must not.
    expect(mapHostMessage(assistantRow({ hidden: true }), { timestampCache: cache() }).hidden).toBe(true);
  });

  it('forwards the scroll anchor and a user row’s context chips', () => {
    const contextItems = [{ type: 'DEVICE', id: 'device-42', label: 'ELK-PROD-07' }];
    const message = mapHostMessage(
      { id: 'u1', role: 'user', content: 'Why is it offline?', scrollAnchor: 'top', contextItems },
      { timestampCache: cache() },
    );

    expect(message.scrollAnchor).toBe('top');
    expect(message.contextItems).toBe(contextItems);
  });

  it('renders segments as the bubble’s content', () => {
    const segments = [{ type: 'text' as const, text: '## Install' }];
    expect(mapHostMessage(assistantRow({ content: '', segments }), { timestampCache: cache() }).content).toBe(segments);
  });

  it('resolves role defaults only where the host supplied nothing', () => {
    const options = { userName: 'Ada Lovelace', userAvatar: 'https://cdn.test/ada.png', timestampCache: cache() };

    expect(mapHostMessage({ id: 'u1', role: 'user', content: 'Hi' }, options)).toMatchObject({
      name: 'Ada Lovelace',
      avatar: 'https://cdn.test/ada.png',
    });
    expect(mapHostMessage({ id: 'u2', role: 'user', content: 'Hi', name: 'Support' }, options).name).toBe('Support');
    expect(mapHostMessage(assistantRow(), options).name).toBe('Mingo');
  });

  it('keeps one row’s fallback timestamp stable across renders', () => {
    // Re-stamping it would move a bubble's time on every unrelated keystroke.
    const timestampCache = cache();
    const first = mapHostMessage(assistantRow(), { timestampCache }).timestamp;
    expect(mapHostMessage(assistantRow(), { timestampCache }).timestamp).toEqual(first);
  });
});

describe('pruneTimestampCache', () => {
  it('forgets rows that left the thread and keeps the ones still in it', () => {
    const timestampCache = new Map([
      ['a1', new Date()],
      ['gone', new Date()],
    ]);
    pruneTimestampCache(timestampCache, new Set(['a1']));

    expect([...timestampCache.keys()]).toEqual(['a1']);
  });
});
