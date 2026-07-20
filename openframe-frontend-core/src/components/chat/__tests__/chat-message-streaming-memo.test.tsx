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
import type { ChatRef } from '../chat-ref.types'

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
const CHAT_REFS: Record<string, ChatRef> = {}
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
      chatRefs: CHAT_REFS,
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

  it('still resolves card markers through the CURRENT plan (ref-read, not closure)', () => {
    seenOverrides.length = 0
    const refs: Record<string, ChatRef> = {
      'blog:abc': { type: 'blog', id: 'abc', title: 'Resolved Title', url: null },
    }
    render(
      <ChatMessageEnhanced
        role="assistant"
        content={[{ type: 'text', text: 'See [card://blog:abc] for more.' }]}
        chatRefs={refs}
        NavLinkAnchor={NavLinkAnchor}
      />,
    )
    const overrides = seenOverrides[0] as { a: React.FC<{ href: string; children?: React.ReactNode }> }
    const out = render(<>{overrides.a({ href: 'card://blog:abc', children: 'x' })}</>)
    expect(out.container.textContent).toBe('Resolved Title')
  })

  /**
   * REGRESSION (round 3): a ref that resolves AFTER the message finished
   * streaming must still reach the pill. The override reads `chatRefs`
   * through a ref, so its own closure is fine — but the markdown engine
   * memoizes completed blocks on the override map's IDENTITY. With
   * `chatRefs` excluded from the override memo's deps entirely, the map kept
   * its old identity, the engine bailed, and the marker rendered its raw-id
   * fallback permanently.
   */
  it('gives componentOverrides a NEW identity when the ref set grows (completed message)', () => {
    seenOverrides.length = 0
    const content: MessageSegment[] = [{ type: 'text', text: 'See [card://blog:late] for more.' }]
    const emptyRefs: Record<string, ChatRef> = {}
    const props = {
      role: 'assistant' as const,
      isTyping: false,
      content,
      NavLinkAnchor,
    }

    const view = render(<ChatMessageEnhanced {...props} chatRefs={emptyRefs} />)
    const before = seenOverrides[seenOverrides.length - 1] as {
      a: React.FC<{ href: string; children?: React.ReactNode }>
    }
    // Unresolved: the raw card id is surfaced so the breakage is visible.
    expect(render(<>{before.a({ href: 'card://blog:late', children: 'x' })}</>).container.textContent)
      .toBe('late')

    // Same content, same everything — only the refs map gains the entry.
    const resolvedRefs: Record<string, ChatRef> = {
      'blog:late': { type: 'blog', id: 'late', title: 'Late Title', url: null },
    }
    view.rerender(<ChatMessageEnhanced {...props} chatRefs={resolvedRefs} />)

    const after = seenOverrides[seenOverrides.length - 1] as {
      a: React.FC<{ href: string; children?: React.ReactNode }>
    }
    expect(after).not.toBe(before)
    expect(render(<>{after.a({ href: 'card://blog:late', children: 'x' })}</>).container.textContent)
      .toBe('Late Title')
  })

  /** …but a same-KEY refs object (new identity, same entries) must NOT churn
   *  the override map — that is the streaming-stability guarantee above. */
  it('keeps the override identity when only the refs object identity changes', () => {
    seenOverrides.length = 0
    const content: MessageSegment[] = [{ type: 'text', text: 'See [card://blog:abc].' }]
    const ref: ChatRef = { type: 'blog', id: 'abc', title: 'T', url: null }
    const props = { role: 'assistant' as const, content, NavLinkAnchor }

    const view = render(<ChatMessageEnhanced {...props} chatRefs={{ 'blog:abc': ref }} />)
    view.rerender(<ChatMessageEnhanced {...props} chatRefs={{ 'blog:abc': ref }} />)

    expect(new Set(seenOverrides).size).toBe(1)
  })
})
