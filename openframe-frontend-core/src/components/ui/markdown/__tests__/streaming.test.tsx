/**
 * Streaming-path tests for the unified markdown engine (plan §D1):
 * atomic-block splitting, fence tail-completion, card-block cache
 * exclusion, and — critically — that the COMPLETION render (streaming
 * flipped off) equals the whole-document parse for every cross-block
 * construct (late reference defs, loose-list numbering, footnote-ish
 * splits, blockquote-internal blank lines, streamed tables).
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { splitStreamingBlocks, completeStreamingTail } from '../streaming'
import { MarkdownEngine } from '../engine'

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({ svg: '<svg data-mock-mermaid="true"></svg>' })),
  },
}))

async function renderHtml(ui: React.ReactElement): Promise<string> {
  let container: HTMLElement
  await act(async () => {
    const result = render(ui)
    container = result.container
    await new Promise((r) => setTimeout(r, 0))
  })
  return container!.innerHTML
}

describe('splitStreamingBlocks', () => {
  it('splits plain paragraphs at blank lines', () => {
    const blocks = splitStreamingBlocks('para one\n\npara two\n\npara three')
    expect(blocks.map((b) => b.memoizable)).toEqual([true, true, false])
    expect(blocks[0].text).toContain('para one')
    expect(blocks[2].text).toContain('para three')
  })

  it('never cuts inside a fenced code block', () => {
    const blocks = splitStreamingBlocks('```js\ncode\n\nmore code\n```\n\nafter')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].text).toContain('more code')
  })

  it('never cuts a loose ordered list apart', () => {
    const md = '1. first\n\n2. second\n\n3. third'
    const blocks = splitStreamingBlocks(md)
    expect(blocks).toHaveLength(1)
  })

  it('never cuts a multi-paragraph blockquote apart', () => {
    const md = '> first para\n\n> second para'
    expect(splitStreamingBlocks(md)).toHaveLength(1)
  })

  it('does not cut before an indented continuation line', () => {
    const md = '- item one\n\n  continuation of item one\n\nnext para'
    const blocks = splitStreamingBlocks(md)
    expect(blocks[0].text).toContain('continuation')
  })

  it('marks card:// and mention:// blocks non-memoizable (stale-card fix)', () => {
    const blocks = splitStreamingBlocks(
      'plain text block\n\nSee [card://blog:x] here\n\nCheck @device:r1 via mention\n\ntail',
    )
    expect(blocks.map((b) => b.memoizable)).toEqual([true, false, true, false])
    // mention text without mention:// scheme stays memoizable; the scheme
    // appears post-remark, so the splitter keys on the raw marker too:
    const withScheme = splitStreamingBlocks('a [x](mention://device:r1) link\n\ntail')
    expect(withScheme[0].memoizable).toBe(false)
  })

  it('marks reference-definition/use and footnote blocks non-memoizable', () => {
    const blocks = splitStreamingBlocks(
      'See [text][ref] please\n\n[ref]: https://example.com\n\nA footnote[^1] here\n\ntail',
    )
    expect(blocks.map((b) => b.memoizable)).toEqual([false, false, false, false])
  })

  it('keys blocks by position so identical blocks never alias', () => {
    const blocks = splitStreamingBlocks('---\n\n---\n\nend')
    expect(blocks.map((b) => b.index)).toEqual([0, 1, 2])
  })
})

describe('completeStreamingTail', () => {
  it('closes an unterminated fence', () => {
    expect(completeStreamingTail('text\n\n```js\nconst x =')).toMatch(/```$/)
  })
  it('leaves balanced fences alone', () => {
    const md = '```js\ncode\n```'
    expect(completeStreamingTail(md)).toBe(md)
  })
  it('does NOT touch stray emphasis/link openers (no false-positive close)', () => {
    for (const md of ['2 * 3 is six', 'a lone _ under', 'an open [ bracket', 'tick ` alone']) {
      expect(completeStreamingTail(md)).toBe(md)
    }
  })
})

describe('MarkdownEngine streaming vs completion equivalence', () => {
  const textOf = (html: string) =>
    html
      .replace(/<style[\s\S]*?<\/style>/, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, '')

  const CASES: Record<string, { md: string; transientTextDivergence?: boolean }> = {
    'loose list keeps numbering': { md: '1. first\n\n2. second\n\n3. third' },
    // Reference links are the DOCUMENTED acceptable mid-stream transient:
    // the use renders literally until the def arrives; completion self-heals.
    'late reference definition resolves': {
      md: 'See [the docs][ref] now.\n\n[ref]: https://example.com/late',
      transientTextDivergence: true,
    },
    'blockquote with internal blank line': { md: '> first\n>\n> second' },
    'gfm table': { md: '| A | B |\n|---|---|\n| 1 | 2 |' },
    'multi-block document': { md: '# Title\n\npara one\n\n- a\n- b\n\npara two' },
  }

  for (const [name, { md, transientTextDivergence }] of Object.entries(CASES)) {
    it(`completion render equals whole-document parse: ${name}`, async () => {
      const streamingHtml = await renderHtml(<MarkdownEngine content={md} streaming />)
      const completedHtml = await renderHtml(<MarkdownEngine content={md} streaming={false} />)
      const wholeHtml = await renderHtml(<MarkdownEngine content={md} />)
      // Completion IS the authoritative whole-document parse — always.
      expect(completedHtml).toBe(wholeHtml)
      if (!transientTextDivergence) {
        expect(textOf(streamingHtml)).toBe(textOf(wholeHtml))
      }
    })
  }

  it('streaming wrapper is aria-live polite', async () => {
    const html = await renderHtml(<MarkdownEngine content={'hello'} streaming />)
    expect(html).toContain('aria-live="polite"')
    const done = await renderHtml(<MarkdownEngine content={'hello'} />)
    expect(done).not.toContain('aria-live')
  })

  it('unterminated fence at the tail renders as code, not swallowed prose', async () => {
    const html = await renderHtml(
      <MarkdownEngine content={'intro\n\n```js\nconst partial ='} streaming />,
    )
    expect(html).toContain('code-block-container')
    // hljs wraps tokens in spans — compare tag-stripped text.
    expect(html.replace(/<[^>]+>/g, '')).toContain('const partial =')
  })
})
