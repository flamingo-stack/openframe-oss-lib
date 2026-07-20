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
import type { Components } from 'react-markdown'
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

  // --- fence-marker fidelity (reviewer-reported failures) ---
  it('does not let ~~~ close a ``` fence', () => {
    const md = '```text\nline\n~~~\n\nstill in code\n```\n\nafter'
    const blocks = splitStreamingBlocks(md)
    // The whole code block stays ONE unit; only the trailing prose splits.
    expect(blocks).toHaveLength(2)
    expect(blocks[0].text).toContain('still in code')
    expect(blocks[1].text.trim()).toBe('after')
  })

  it('does not let ``` close a ~~~ fence', () => {
    const blocks = splitStreamingBlocks('~~~text\nline\n```\n\nstill in code\n~~~\n\nafter')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].text).toContain('still in code')
  })

  it('ignores fences inside 4-space-indented code (CommonMark caps indent at 3)', () => {
    const blocks = splitStreamingBlocks('    ```\n    not a fence\n\nreal para\n\ntail')
    expect(blocks.length).toBeGreaterThan(1)
    expect(blocks.some((b) => b.text.includes('real para'))).toBe(true)
  })

  it('requires the closer to be at least as long as the opener', () => {
    // The inner ``` is CONTENT of the ````-opened block.
    const blocks = splitStreamingBlocks('````\n```\n\ninner\n````\n\nafter')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].text).toContain('inner')
  })

  // --- raw HTML block integrity ---
  it('never cuts inside an unbalanced raw HTML block', () => {
    const blocks = splitStreamingBlocks(
      '<details>\n<summary>More</summary>\n\nbody text\n\n</details>\n\ntail',
    )
    expect(blocks).toHaveLength(2)
    expect(blocks[0].text).toContain('body text')
    expect(blocks[0].text).toContain('</details>')
    // Raw HTML units are never cached.
    expect(blocks.every((b) => !b.memoizable)).toBe(true)
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

  it('does not append a bogus fence when ``` and ~~~ both appear (closed block)', () => {
    const md = '```\n~~~\n```'
    expect(completeStreamingTail(md)).toBe(md)
  })

  it('does not append a bogus fence to a ```-block containing a ~~~ line', () => {
    const md = '```text\nline\n~~~\n\nstill in code\n```\n\nafter'
    expect(completeStreamingTail(md)).toBe(md)
  })

  it('closes an unterminated ~~~ fence with ~~~ (the RECORDED opener)', () => {
    expect(completeStreamingTail('~~~py\nx =')).toBe('~~~py\nx =\n~~~')
  })

  it('closes with a run at least as long as the opener', () => {
    expect(completeStreamingTail('````\nstuff')).toBe('````\nstuff\n````')
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

  it('raw HTML block renders identically mid-stream and completed', async () => {
    const md = '<details>\n<summary>More</summary>\n\nbody text\n\n</details>\n\ntail'
    const streamingHtml = await renderHtml(<MarkdownEngine content={md} streaming />)
    const wholeHtml = await renderHtml(<MarkdownEngine content={md} />)
    // Strip only the streaming aria-live wrapper; the disclosure widget and
    // its body must be structurally identical (body INSIDE <details>, the
    // closing tag not dropped).
    const stripWrapper = (html: string) =>
      html
        .replace('<div aria-live="polite" aria-relevant="additions text">', '')
        .replace('</div></article>', '</article>')
    expect(streamingHtml).toContain('<details')
    expect(streamingHtml).toContain('body text')
    expect(stripWrapper(streamingHtml).replace(/\s+/g, '')).toBe(
      stripWrapper(wholeHtml).replace(/\s+/g, ''),
    )
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

// ---------------------------------------------------------------------------
// Atomic-block memo (regression: the memo never hit)
// ---------------------------------------------------------------------------
describe('streaming atomic-block memoization', () => {
  /**
   * Module-scope so the override map's IDENTITY is stable across rerenders —
   * otherwise the test would be measuring its own instability instead of the
   * engine's. The counter proves memo HITS: without it, DOM reconciliation
   * reuses the same nodes either way, so node identity alone cannot fail.
   */
  let paragraphRenders = 0
  const COUNTING_OVERRIDES: Partial<Components> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p: ({ children }: any) => {
      paragraphRenders++
      return <p>{children}</p>
    },
  }

  it('does NOT re-render completed blocks when the tail grows', async () => {
    const base = 'alpha para\n\nbeta para\n\ngamma tail'
    paragraphRenders = 0

    let container!: HTMLElement
    let rerender!: (ui: React.ReactElement) => void
    await act(async () => {
      const result = render(
        <MarkdownEngine content={base} streaming componentOverrides={COUNTING_OVERRIDES} />,
      )
      container = result.container
      rerender = result.rerender
      await new Promise((r) => setTimeout(r, 0))
    })

    const firstParagraph = container.querySelector('p')
    expect(firstParagraph?.textContent).toBe('alpha para')
    expect(paragraphRenders).toBe(3)

    const before = paragraphRenders
    await act(async () => {
      rerender(
        <MarkdownEngine
          content={`${base} and more`}
          streaming
          componentOverrides={COUNTING_OVERRIDES}
        />,
      )
      await new Promise((r) => setTimeout(r, 0))
    })

    // Only the live tail may re-parse. Before the NO_BROKEN_LINKS fix the
    // `components` memo re-created every render, so all THREE re-rendered.
    expect(paragraphRenders - before).toBe(1)
    // …and the completed block's DOM node is the very same element.
    expect(Object.is(container.querySelector('p'), firstParagraph)).toBe(true)
  })
})
