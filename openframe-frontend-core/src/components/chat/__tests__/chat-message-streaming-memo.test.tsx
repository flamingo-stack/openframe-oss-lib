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

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { MessageSegment } from '../types'

/** Every `componentOverrides` / `additionalRemarkPlugins` identity the
 *  component handed the markdown renderer, in render order. */
const seenOverrides: unknown[] = []
const seenPlugins: unknown[] = []

vi.mock('../../ui/markdown/simple-markdown-renderer', () => ({
  SimpleMarkdownRenderer: ({
    content,
    componentOverrides,
    additionalRemarkPlugins,
  }: {
    content: string
    componentOverrides?: unknown
    additionalRemarkPlugins?: unknown
  }) => {
    seenOverrides.push(componentOverrides)
    seenPlugins.push(additionalRemarkPlugins)
    return <div data-testid="md">{content}</div>
  },
}))

import { ChatMessageEnhanced } from '../chat-message-enhanced'

function NavLinkAnchor({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href}>{children}</a>
}
const renderMention = () => null

/** Fresh array per call — the reducer replaces `segments` on every delta. */
const segmentsFor = (tail: string): MessageSegment[] => [
  { type: 'text', text: `First paragraph, already complete.\n\n${tail}` },
]

describe('ChatMessageEnhanced — override identity across a streamed turn', () => {
  it('keeps componentOverrides + remark plugins referentially stable per token', () => {
    seenOverrides.length = 0
    seenPlugins.length = 0

    const props = {
      role: 'assistant' as const,
      isTyping: true,
      renderMention,
      NavLinkAnchor,
    }

    const view = render(<ChatMessageEnhanced {...props} content={segmentsFor('Tail')} />)
    expect(seenOverrides.length).toBeGreaterThan(0)
    const firstOverrides = seenOverrides[0]
    const firstPlugins = seenPlugins[0]
    expect(firstOverrides).toBeTruthy()

    let tail = 'Tail'
    for (let i = 0; i < 10; i += 1) {
      tail += ` token${i}`
      view.rerender(<ChatMessageEnhanced {...props} content={segmentsFor(tail)} />)
    }

    // ONE identity for the whole turn. Before the fix this produced a fresh
    // object on each of the 11 renders.
    expect(new Set(seenOverrides).size).toBe(1)
    expect(seenOverrides.every((o) => o === firstOverrides)).toBe(true)
    expect(new Set(seenPlugins).size).toBe(1)
    expect(seenPlugins.every((p) => p === firstPlugins)).toBe(true)

    // Sanity: the tail really did stream through.
    expect(view.container.textContent).toContain('token9')
  })

  it('surfaces the raw card id when the host renderer resolves nothing', () => {
    // The marker is the ONLY data channel now: with the host's
    // `renderEntityCard` returning null (no card type registered / nothing
    // to hydrate), the `<a card://…>` override must render the dim raw-id
    // fallback — never a real-looking card, never the literal marker URL.
    seenOverrides.length = 0
    render(
      <ChatMessageEnhanced
        role="assistant"
        content={[{ type: 'text', text: 'See [card://blog:abc] for more.' }]}
        renderEntityCard={() => null}
        NavLinkAnchor={NavLinkAnchor}
      />,
    )
    const overrides = seenOverrides[0] as { a: React.FC<{ href: string; children?: React.ReactNode }> }
    const out = render(<>{overrides.a({ href: 'card://blog:abc', children: 'x' })}</>)
    expect(out.container.textContent).toBe('abc')
  })

  it('mounts the host card from the marker descriptor alone (hydrate-by-id)', () => {
    // No refs frame exists: the renderer receives the minimal
    // `{type, id, title: id, url: null}` descriptor built from the marker
    // and is expected to self-fetch. The rendered node is hoisted as a
    // block sibling of the text.
    const seenRefs: Array<{ type: string; id: string }> = []
    const view = render(
      <ChatMessageEnhanced
        role="assistant"
        content={[{ type: 'text', text: 'See [card://blog:abc] for more.' }]}
        renderEntityCard={(ref) => {
          seenRefs.push({ type: ref.type, id: ref.id })
          return <div data-testid="card">card:{ref.id}</div>
        }}
        NavLinkAnchor={NavLinkAnchor}
      />,
    )
    expect(seenRefs).toEqual([{ type: 'blog', id: 'abc' }])
    expect(view.container.textContent).toContain('card:abc')
  })
})
