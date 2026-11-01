/**
 * REGRESSION: `ChatMessageEnhanced` must hand the markdown engine a
 * REFERENTIALLY STABLE `componentOverrides` map across a streamed turn.
 *
 * The engine memoizes each COMPLETED block (`StreamingBlockRenderer`) on its
 * `components` prop identity. `ChatMessageEnhanced` is the sole production
 * caller, and it used to defeat that memo one level up: `cardComponentOverrides`
 * listed `renderingPlan` in its deps, `renderingPlan` is memoized on `segments`,
 * and the stream reducer replaces `segments` on EVERY text delta. So the
 * override map got a new identity per token → the engine's `components` memo
 * re-created → every completed block re-parsed on every token.
 *
 * The engine's own streaming test cannot catch this: it passes a module-scope
 * stable override map. This test drives the real component with the real
 * per-delta `content` churn a reducer produces, and asserts at the SEAM (the
 * props the component hands the renderer) rather than through the engine's
 * internals — the two are separately owned.
 */

import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, it, expect, vi } from 'vitest';
import type { MessageSegment } from '../types';

/** Every `componentOverrides` / `additionalRemarkPlugins` identity the
 *  component handed the markdown renderer, in render order. */
const seenOverrides: unknown[] = [];
const seenPlugins: unknown[] = [];

vi.mock('../../ui/markdown/simple-markdown-renderer', () => ({
  SimpleMarkdownRenderer: ({
    content,
    componentOverrides,
    additionalRemarkPlugins,
  }: {
    content: string;
    componentOverrides?: unknown;
    additionalRemarkPlugins?: unknown;
  }) => {
    seenOverrides.push(componentOverrides);
    seenPlugins.push(additionalRemarkPlugins);
    return <div data-testid="md">{content}</div>;
  },
}));

import { ChatMessageEnhanced } from '../chat-message-enhanced';

function NavLinkAnchor({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href}>{children}</a>;
}
const renderRecordChip = () => null;

/** Fresh array per call — the reducer replaces `segments` on every delta. */
const segmentsFor = (tail: string): MessageSegment[] => [
  { type: 'text', text: `First paragraph, already complete.\n\n${tail}` },
];

describe('ChatMessageEnhanced — override identity across a streamed turn', () => {
  it('keeps componentOverrides + remark plugins referentially stable per token', () => {
    seenOverrides.length = 0;
    seenPlugins.length = 0;

    const props = {
      role: 'assistant' as const,
      isTyping: true,
      renderRecordChip,
      NavLinkAnchor,
    };

    const view = render(<ChatMessageEnhanced {...props} content={segmentsFor('Tail')} />);
    expect(seenOverrides.length).toBeGreaterThan(0);
    const firstOverrides = seenOverrides[0];
    const firstPlugins = seenPlugins[0];
    expect(firstOverrides).toBeTruthy();

    let tail = 'Tail';
    for (let i = 0; i < 10; i += 1) {
      tail += ` token${i}`;
      view.rerender(<ChatMessageEnhanced {...props} content={segmentsFor(tail)} />);
    }

    // ONE identity for the whole turn. Before the fix this produced a fresh
    // object on each of the 11 renders.
    expect(new Set(seenOverrides).size).toBe(1);
    expect(seenOverrides.every(o => o === firstOverrides)).toBe(true);
    expect(new Set(seenPlugins).size).toBe(1);
    expect(seenPlugins.every(p => p === firstPlugins)).toBe(true);

    // Sanity: the tail really did stream through.
    expect(view.container.textContent).toContain('token9');
  });

  it('mounts the card of a shown record from its id alone, titled by the link (hydrate-by-id)', () => {
    // No refs frame exists: the renderer receives the minimal
    // `{type, id, title: <link text>, url: null}` descriptor and is expected
    // to self-fetch. It is drawn above the answer.
    const seenRefs: Array<{ type: string; id: string; title: string }> = [];
    render(
      <ChatMessageEnhanced
        role="assistant"
        content={[
          { type: 'record_cards', cards: [{ type: 'blog_post', id: 'abc' }] },
          { type: 'text', text: 'See [Hello](record://blog_post/abc) for more.' },
        ]}
        renderEntityCard={ref => {
          seenRefs.push({ type: ref.type, id: ref.id, title: ref.title });
          return <div data-testid="card">card:{ref.id}</div>;
        }}
        NavLinkAnchor={NavLinkAnchor}
      />,
    );
    expect(seenRefs).toEqual([{ type: 'blog_post', id: 'abc', title: 'Hello' }]);
    expect(screen.getByTestId('chat-record-cards').textContent).toContain('card:abc');
  });
});
