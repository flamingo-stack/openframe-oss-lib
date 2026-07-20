/**
 * Phase-0 GOLDEN CHARACTERIZATION TESTS for the markdown renderer unification.
 *
 * These snapshots capture the CURRENT output of `SimpleMarkdownRenderer` and
 * `RichMarkdownRenderer` over a fixture corpus BEFORE the unified engine
 * refactor. After the refactor the same tests must produce identical
 * snapshots, except for deltas explicitly reviewed in the migration plan
 * (blockquote bg token, ODS `article` typography preset, sanitizer applied
 * to Rich).
 *
 * Leaf embed components (Video, Reddit/Twitter/LinkedIn embeds,
 * OGLinkPreview, FigmaEmbed, MarkdownImage) and `mermaid` are mocked to
 * cheap deterministic stubs — the parity target is the RENDERER PIPELINE
 * (remark/rehype plugins, preprocessing, component map, heading ids,
 * sanitization), not the leaves. The same mocks apply pre- and
 * post-refactor, so snapshots stay comparable.
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Leaf mocks (stable across the refactor)
// ---------------------------------------------------------------------------
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({ svg: '<svg data-mock-mermaid="true" width="100" height="50"></svg>' })),
  },
}))

vi.mock('@/components/features/video', () => ({
  Video: ({ kind, url, poster }: any) => (
    <div data-mock="video" data-kind={kind} data-url={url} data-poster={poster ?? ''} />
  ),
}))

vi.mock('@/components/embeds/reddit-embed-client', () => ({
  RedditEmbedClient: ({ url }: any) => <div data-mock="reddit" data-url={url} />,
}))

vi.mock('@/components/embeds/twitter-embed-client', () => ({
  TwitterEmbedClient: ({ url }: any) => <div data-mock="twitter" data-url={url} />,
}))

vi.mock('@/components/embeds/linkedin-embed-client', () => ({
  LinkedInEmbedClient: ({ url }: any) => <div data-mock="linkedin" data-url={url} />,
}))

vi.mock('@/components/embeds/og-link-preview', () => ({
  OGLinkPreview: ({ url }: any) => <div data-mock="og-preview" data-url={url} />,
  OGLinkErrorBoundary: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/components/embeds/figma-embed', () => ({
  FigmaEmbed: ({ url }: any) => <div data-mock="figma" data-url={url} />,
}))

vi.mock('@/components/embeds/markdown-image', () => ({
  MarkdownImage: ({ src, alt }: any) => <img data-mock="markdown-image" src={src} alt={alt ?? ''} />,
}))

import { SimpleMarkdownRenderer } from '../markdown'
import { RichMarkdownRenderer } from '../markdown'
import { remarkCardLinks } from '../../chat/remark-card-links'
import { remarkMentionChips } from '../../chat/remark-mention-chips'
import { extractSections } from '../../../utils/markdown-section-extractor'
import { scanHeadings } from '../../../utils/markdown-heading-id'
import { __buildCloserHaystackForTest } from '../markdown/sanitize'
import { unified } from 'unified'
import remarkParse from 'remark-parse'

// ---------------------------------------------------------------------------
// Fixture corpus (per migration plan §D1 parity verification)
// ---------------------------------------------------------------------------
const SHARED_FIXTURES: Record<string, string> = {
  'gfm-table': `
| Col A | Col B |
|-------|-------|
| a1    | b1    |
| a2    | b2    |
`,
  'task-list': `
- [x] done item
- [ ] open item
`,
  'nested-lists': `
1. first
   - nested a
   - nested b
2. second
   1. sub one
   2. sub two
`,
  'loose-ordered-list': `
1. first paragraph item

2. second paragraph item

3. third paragraph item
`,
  'fenced-code-js': '```js\nconst x = 1;\nconsole.log(x < 2 && x > 0);\n```',
  'fenced-code-unknown-lang': '```qwerty-lang\nsome text < with > angles\n```',
  'inline-code': 'Use `<their>` and `npm install` inline.',
  mermaid: '```mermaid\ngraph TD;\nA-->B;\n```',
  'headings-with-emoji-and-dupes': `
# 🚀 Getting Started

## Setup

## Setup

### Deep Dive 🔧

#### H4 level

##### H5 level

###### H6 level
`,
  links: `
[external](https://example.com/page) and [anchor](#setup) and plain text.
`,
  'reference-style-link': `
See [the docs][ref] for details.

[ref]: https://example.com/reference
`,
  images: `
![alt text](https://example.com/pic.png)

![](https://example.com/no-alt.png)
`,
  'empty-image': '![empty]()',
  blockquote: `
> A quoted paragraph
> spanning two lines.
`,
  'blockquote-with-blank-line': `
> first quoted para
>
> second quoted para
`,
  hr: 'above\n\n---\n\nbelow',
  'raw-html-safe': `
<details><summary>More</summary>

hidden body

</details>

Line<br>break and <kbd>Ctrl</kbd>+<mark>C</mark>.
`,
  'raw-html-unknown-tag': 'Share <their> settings and the <ticket> element.',
  // The pre-pass must not escape tags the sanitizer keeps: `strike` lives in
  // `defaultSchema.tagNames` but was absent from SAFE_HTML_TAGS, so authored
  // legacy markup regressed into visible `&lt;strike&gt;` source text.
  'legacy-strike-tag': 'A <strike>struck</strike> phrase and <tt>teletype</tt>.',
  // Round-2: `center`/`font`/`big` were in NONE of the three tag lists, so
  // they escaped to visible source text even though both pre-unification
  // renderers rendered them.
  'legacy-center-tag': '<center>centered</center>\n\n<font color="red" size="3">colored</font> and <big>big</big>.',
  // Round-2 SECURITY: `title` (and `text`/`desc`/`g`/…) are SVG element names
  // that are ALSO HTML elements. Unconstrained they let any post or chat
  // message emit a live `<title>`, which React 19 hoists into <head> —
  // rewriting the browser tab + SEO title. They are now pinned to an `svg`
  // ancestor, so a bare one is dropped and only its text remains.
  'bare-title-tag-is-inert': '# Real Post\n\n<title>Buy cheap pills</title>\n\nbody',
  // Round-3 SECURITY/CORRECTNESS: RAWTEXT tokenization runs BEFORE the
  // sanitizer, so an UNCLOSED `<textarea>` / `<iframe>` / `<title>` swallows
  // the whole rest of the message during parsing — the round-2 `ancestors`
  // pin cannot help. Any message that merely MENTIONS these in prose (an LLM
  // explaining HTML forms will) mangled everything after it. The text
  // pre-pass now escapes unclosed openers; the heading after must survive.
  'unclosed-textarea-does-not-swallow': 'Hello\n\n<textarea>\n\n## After heading\n\nmore',
  'unclosed-iframe-does-not-swallow': 'Hello\n\n<iframe>\n\n## After heading\n\nmore',
  'unclosed-title-does-not-swallow': 'Hello\n\n<title>\n\n## After heading\n\nmore',
  // Round-4 SECURITY: the round-3 closer test searched the RAW document, so a
  // `</textarea>` that is only a CODE SAMPLE (fenced or inline) or only
  // ATTRIBUTE TEXT satisfied "is closed later" and left the prose opener LIVE
  // — parse5's RAWTEXT span then swallowed the rest of the message anyway.
  // An LLM answer about HTML forms is exactly a prose mention plus a code
  // sample, so the fix was one realistic message away from being bypassed.
  // The closer search now runs over a length-preserving MASKED copy (code
  // spans + attribute regions blanked), built from the SAME regex that drives
  // the escaping carve. In all three the opener must escape and the heading
  // after it must survive as a real <h1>.
  'rawtext-closer-in-fence-does-not-unescape':
    '<textarea>\n\n# Heading\n\npara2\n\n```html\n</textarea>\n```',
  'rawtext-closer-in-inline-code-does-not-unescape':
    '<textarea>\n\n# Heading\n\npara2 with `</textarea>` inline',
  'rawtext-closer-in-attribute-does-not-unescape':
    '<textarea>\n\n# Heading\n\n<div title="</textarea>">x</div>',
  'rawtext-title-closer-in-fence-does-not-unescape':
    '<title>\n\n# Heading\n\n```html\n</title>\n```',
  // Round-5 SECURITY: the round-4 mask claimed every index matched the
  // original string, but it started with `text.toLowerCase()` — and
  // `toLowerCase()` EXPANDS U+0130 (Turkish dotted capital `İ`, ordinary
  // prose: İstanbul, İzmir) into `i` + U+0307, 1 code unit → 2. Each one
  // before an opener shifted the haystack later than the offset the caller
  // computes from the ORIGINAL text, so `hasLaterCloser` started scanning
  // BEFORE the opener, matched the already-consumed `</textarea>`, and left
  // the prose opener LIVE — the RAWTEXT swallow, reopened. At n≤20 the opener
  // escaped correctly; at n≥25 the heading and list below became the editable
  // value of a live textarea. The mask now folds ASCII only (tag names are
  // ASCII by definition); the length invariant below is the real guard.
  'rawtext-mask-survives-turkish-dotted-i':
    `${'İ'.repeat(25)} <textarea>a</textarea>\n\n<textarea>\n\n## Later heading\n\n- item one\n`,
  // Round-5 LOGIC: the escape pre-pass used to run BEFORE the streaming tail
  // was completed. Mid-stream every partially-emitted fence is unclosed, and
  // both fence notions in the pre-pass only recognize CLOSED fences — so a
  // `</textarea>` inside the still-open fence satisfied "is closed later" and
  // the prose opener above stayed live. The engine now completes the tail
  // first; this AUTHORED (never-closed) shape is covered by the mask's
  // `blankUnclosedFence` pass, and the streaming shape by the test below.
  'rawtext-closer-in-unclosed-fence-does-not-unescape':
    'Explaining <textarea> in HTML.\n\n## Heading\n\n```html\n</textarea>\n',
  // Round-4 POLISH: the escaping carve's fence notion was naive triple
  // backticks, so a `~~~`-fenced block's `<textarea>` was NOT protected and
  // rendered as visible escaped text inside the code block.
  'tilde-fence-protects-html-sample': 'intro\n\n~~~html\n<textarea>sample</textarea>\n~~~',
  // …and the PROPERLY CLOSED forms must still render as real elements.
  'closed-textarea-still-renders': 'Hello\n\n<textarea>edit me</textarea>\n\n## After heading\n\nmore',
  'closed-iframe-still-renders':
    'Hello\n\n<iframe src="https://example.com/frame" width="300"></iframe>\n\n## After heading\n\nmore',
  // …while the legitimate in-SVG accessible-name element still renders.
  'svg-title-a11y-label':
    '<svg viewBox="0 0 24 24" role="img"><title>Coverage chart</title><desc>Four quarters</desc><circle cx="12" cy="12" r="10"/></svg>',
  // Round-2: SVG presentation attributes must survive with their hast
  // (camelCase) spellings — `font-size`/`text-anchor`/`stroke-dasharray`/
  // `style` were all being silently stripped.
  'inline-svg-presentation-attrs':
    '<svg viewBox="0 0 40 20"><rect x="0" y="0" width="40" height="20" fill="none" stroke-dasharray="2 2" style="opacity:0.5"/><text x="20" y="12" font-size="9" text-anchor="middle" dominant-baseline="middle">42</text></svg>',
  // Round-2: `required.input` force-rewrote EVERY authored input into a
  // disabled checkbox. Now a text input degrades to a bare <input> and the
  // GFM task-list contract (see `task-list`) is unaffected.
  'authored-text-input': '<form><input type="text" placeholder="email"><button>go</button></form>',
  // Inline SVG renders in published posts; the pre-unification Rich renderer
  // had no pre-pass and no sanitizer, so it always survived.
  'inline-svg': '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12l3 3 5-6"/></svg>',
  'hostile-script': 'before\n\n<script>alert(1)</script>\n\nafter',
  'hostile-onerror': '<img src="https://example.com/x.png" onerror="alert(1)">',
  'hostile-js-href': '<a href="javascript:alert(1)">click</a>',
  'hostile-srcset': '<img src="https://safe.example/a.png" srcset="https://safe.example/a.png 1x, javascript:alert(1) 2x">',
  'hostile-iframe-srcdoc': '<iframe srcdoc="<script>alert(1)</script>" src="https://example.com/frame"></iframe>',
  'hostile-style-block': 'text\n\n<style>body{display:none}</style>\n\nmore',
}

const RICH_ONLY_FIXTURES: Record<string, string> = {
  'shortcode-youtube': 'Intro\n\n{{youtube:abc123XYZ_-}}\n\nOutro',
  'shortcode-youtube-markdoc': '{% youtube id="vid42" /%}',
  'shortcode-youtube-thumbnail-link':
    '[![Demo](https://img.youtube.com/vi/awc-yAnkhIo/maxresdefault.jpg)](https://www.youtube.com/watch?v=awc-yAnkhIo)',
  'shortcode-reddit': '{{reddit:https://reddit.com/r/msp/comments/1/post}}',
  'shortcode-tweet': '{{tweet:https://twitter.com/user/status/12345}}',
  'shortcode-figma': '{{figma:https://www.figma.com/design/abc/My-File}}',
  'shortcode-linkedin': '{{linkedin:https://www.linkedin.com/posts/someone_activity-1}}',
  'shortcode-link-preview': '{{link:https://example.com/article}}',
  'auto-url-youtube': 'watch this https://www.youtube.com/watch?v=dQw4w9WgXcQ now',
  'auto-url-reddit': 'thread https://www.reddit.com/r/msp/comments/9/thread here',
  'auto-url-tweet': 'see https://x.com/user/status/999888 today',
  'auto-url-figma': 'design https://www.figma.com/proto/xyz/Proto-File end',
  'auto-url-generic-link-preview': 'read https://blog.example.com/post-1 tonight',
  'auto-url-inside-md-link-not-embedded': 'already [a link](https://blog.example.com/post-2) inline',
  'auto-url-inside-code-not-embedded': 'code `https://blog.example.com/post-3` inline\n\n```\nhttps://blog.example.com/post-4\n```',
  'auto-url-inside-table-not-embedded': `
| Site |
|------|
| https://blog.example.com/post-5 |
`,
  'fence-youtube-embed': '```youtube-embed\nvidFENCE1\n```',
  'fence-reddit-embed': '```reddit-embed\nhttps://reddit.com/r/x/comments/2/y\n```',
  'fence-tweet-embed': '```tweet-embed\nhttps://twitter.com/a/status/777\n```',
  'fence-link-preview': '```link-preview\nhttps://example.com/fenced\n```',
  'fence-figma-embed': '```figma-embed\nhttps://www.figma.com/deck/q/Deck\n```',
  'fence-linkedin-embed': '```linkedin-embed\nhttps://www.linkedin.com/posts/p_activity-2\n```',
  'raw-video-tag': '<video src="https://stream.example.com/v.mp4" poster="https://example.com/p.jpg" controls class="w-full my-8 rounded-lg"></video>',
  // 2026-07 content-store audit: real blog posts carry inline style attrs
  // (div.takeaway, table styling) — must survive the sanitize schema.
  'audit-style-attrs': '<div class="takeaway" style="padding:8px">Key point</div>\n\n<p style="color:red">styled para</p>',
  // 2026-07 content-store audit: 58 posts use Reddit's own embed markup
  // (script stripped by sanitize; blockquote rehydrated to RedditEmbedClient).
  'audit-reddit-embed-bq':
    '<blockquote class="reddit-embed-bq" data-embed-height="500"><p>Post title</p><a href="https://www.reddit.com/r/msp/comments/abc/post/">view</a></blockquote>\n<script async src="https://embed.reddit.com/widgets.js" charset="UTF-8"></script>',
}

const CHAT_FIXTURES: Record<string, string> = {
  'card-marker': 'Here is the record: [card://blog:hello-world] inline.',
  'mention-chip': 'Check @device:router-9 status.',
  'card-and-mention-mixed': 'See [card://vendor:acme] and @ticket:T-100 together.',
}

const SECTION_IDS = [
  { id: 'getting-started', title: '🚀 Getting Started', level: 1 },
  { id: 'setup', title: 'Setup', level: 2 },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function renderStable(ui: React.ReactElement): Promise<HTMLElement> {
  let container: HTMLElement
  await act(async () => {
    const result = render(ui)
    container = result.container
    // Flush the mermaid mount → dynamic-import → setSvg chain.
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
  })
  return container!
}

function normalize(html: string): string {
  // The mermaid <style> block is a constant — collapse whitespace only.
  return html.replace(/\s+\n/g, '\n')
}

// ---------------------------------------------------------------------------
// SimpleMarkdownRenderer parity
// ---------------------------------------------------------------------------
describe('SimpleMarkdownRenderer golden parity', () => {
  for (const [name, md] of Object.entries(SHARED_FIXTURES)) {
    it(`renders fixture: ${name}`, async () => {
      const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
      expect(normalize(container.innerHTML)).toMatchSnapshot()
    })
  }

  it('renders headings with backend sectionIds + demoteMarkdownH1ToH2', async () => {
    const container = await renderStable(
      <SimpleMarkdownRenderer
        content={SHARED_FIXTURES['headings-with-emoji-and-dupes']}
        sectionIds={SECTION_IDS}
        demoteMarkdownH1ToH2
      />,
    )
    expect(normalize(container.innerHTML)).toMatchSnapshot()
  })

  it('renders broken links with badge', async () => {
    const container = await renderStable(
      <SimpleMarkdownRenderer
        content={'[good](./ok.md) and [bad](./missing.md)'}
        brokenLinks={['./missing.md']}
        currentPath="docs/index.md"
        onInternalLinkClick={() => {}}
      />,
    )
    expect(normalize(container.innerHTML)).toMatchSnapshot()
  })

  it('renders each text-size preset', async () => {
    for (const preset of ['default', 'compact', 'large'] as const) {
      const container = await renderStable(
        <SimpleMarkdownRenderer content={'# H\n\npara\n\n- li'} textSize={preset} />,
      )
      expect(normalize(container.innerHTML)).toMatchSnapshot(`textSize-${preset}`)
    }
  })

  for (const [name, md] of Object.entries(CHAT_FIXTURES)) {
    it(`renders chat fixture with card/mention plugins: ${name}`, async () => {
      const container = await renderStable(
        <SimpleMarkdownRenderer
          content={md}
          textSize="compact"
          additionalRemarkPlugins={[remarkCardLinks, remarkMentionChips]}
        />,
      )
      expect(normalize(container.innerHTML)).toMatchSnapshot()
    })
  }
})

// ---------------------------------------------------------------------------
// RAWTEXT mask invariants (round-5)
// ---------------------------------------------------------------------------
describe('closer-search mask', () => {
  // THE invariant the whole RAWTEXT guard rests on. `escapeOutsideFences`
  // computes `segmentOffset + index + match.length` from the ORIGINAL text and
  // indexes into the mask with it, so any length drift makes `hasLaterCloser`
  // search the wrong window — silently, and in the fail-OPEN direction.
  it('is LENGTH-PRESERVING over the whole fixture corpus', () => {
    for (const [name, md] of Object.entries({
      ...SHARED_FIXTURES,
      ...RICH_ONLY_FIXTURES,
      ...CHAT_FIXTURES,
    })) {
      expect(__buildCloserHaystackForTest(md).length, name).toBe(md.length)
    }
  })

  it('is LENGTH-PRESERVING for U+0130 (the one BMP char toLowerCase expands)', () => {
    // `'İ'.toLowerCase()` is 'i' + U+0307 — 1 code unit becomes 2. This is the
    // only such BMP character, and it is ordinary Turkish prose.
    expect('İ'.toLowerCase().length).toBe(2)
    for (const src of ['İ', 'İstanbul', `${'İ'.repeat(25)} <textarea>`, 'İ<TEXTAREA>İ</TEXTAREA>']) {
      expect(__buildCloserHaystackForTest(src).length, JSON.stringify(src)).toBe(src.length)
    }
  })

  it('still folds ASCII case, so an UPPERCASE closer is found', () => {
    expect(__buildCloserHaystackForTest('<TEXTAREA>x</TEXTAREA>')).toContain('</textarea>')
  })

  it('leaves the opener live when a REAL closer follows, regardless of İ count', async () => {
    for (const n of [0, 20, 25, 60]) {
      const md = `${'İ'.repeat(n)} <textarea>a</textarea>\n\n<textarea>\n\n## Later heading\n\n- item one\n`
      const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
      // Exactly ONE textarea: the properly closed one. The bare opener must be
      // escaped, so the heading and the list below survive as real elements.
      expect(container.querySelectorAll('textarea').length, `n=${n}`).toBe(1)
      expect(container.querySelectorAll('h2').length, `n=${n}`).toBe(1)
      expect(container.querySelectorAll('li').length, `n=${n}`).toBe(1)
    }
  })
})

// ---------------------------------------------------------------------------
// Streaming pre-pass ordering (round-5)
// ---------------------------------------------------------------------------
describe('streaming completes the tail BEFORE escaping', () => {
  it('a `</textarea>` inside a still-open fence does not unescape the prose opener', async () => {
    // The canonical shape: an LLM explains `<textarea>`, then streams a fenced
    // HTML sample. Mid-emission the fence is unclosed, so escaping first left
    // the prose opener live and parse5 swallowed the rest of the message.
    const md = 'Explaining <textarea> in HTML.\n\n## Heading\n\n```html\n</textarea>\n'
    const container = await renderStable(<SimpleMarkdownRenderer content={md} streaming />)
    expect(container.querySelectorAll('textarea').length).toBe(0)
    expect(container.querySelector('h2')?.textContent).toBe('Heading')
    expect(container.textContent).toContain('Explaining <textarea> in HTML.')
  })

  it('does NOT escape an unknown tag inside a mid-emission fence', async () => {
    // The carve's "unclosed fence body is unprotected" tradeoff used to fire on
    // EVERY streaming frame: a `<their>` mid-fence rendered as literal
    // `&lt;their&gt;` until the closer arrived, then snapped back.
    const md = 'intro\n\n```html\n<their>x</their>\n'
    const container = await renderStable(<SimpleMarkdownRenderer content={md} streaming />)
    expect(container.textContent).toContain('<their>x</their>')
    expect(container.textContent).not.toContain('&lt;their&gt;')
  })

  it('token-by-token growth through an open fence never swallows the document', async () => {
    const full = 'Explaining <textarea> in HTML.\n\n## Heading\n\n```html\n<textarea>v</textarea>\n```\n'
    // Start once `## Heading\n` has fully arrived (earlier cuts legitimately
    // show a partial title) and walk the rest of the fence in small steps.
    const from = full.indexOf('## Heading') + '## Heading\n'.length
    for (let cut = from; cut <= full.length; cut += 3) {
      const container = await renderStable(
        <SimpleMarkdownRenderer content={full.slice(0, cut)} streaming />,
      )
      expect(container.querySelector('h2')?.textContent, `cut=${cut}`).toBe('Heading')
    }
  })
})

// ---------------------------------------------------------------------------
// RichMarkdownRenderer parity
// ---------------------------------------------------------------------------
describe('RichMarkdownRenderer golden parity', () => {
  for (const [name, md] of Object.entries({ ...SHARED_FIXTURES, ...RICH_ONLY_FIXTURES })) {
    it(`renders fixture: ${name}`, async () => {
      const container = await renderStable(<RichMarkdownRenderer content={md} />)
      expect(normalize(container.innerHTML)).toMatchSnapshot()
    })
  }

  it('renders headings with backend sectionIds + demoteMarkdownH1ToH2', async () => {
    const container = await renderStable(
      <RichMarkdownRenderer
        content={SHARED_FIXTURES['headings-with-emoji-and-dupes']}
        sectionIds={SECTION_IDS}
        demoteMarkdownH1ToH2
      />,
    )
    expect(normalize(container.innerHTML)).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// Heading-id ↔ section-extractor agreement (three slug copies today —
// this pins the CURRENT agreement so the Phase-1 shared helper can prove
// it changed nothing)
// ---------------------------------------------------------------------------
describe('heading-id and section-extractor slug agreement', () => {
  // Includes a THIRD duplicate (`setup-3` — the suffix counter must keep
  // counting, not reset per pair) and a SYMBOL-ONLY heading (`## !!!`, whose
  // slug collapses to '' and hits the `section-N` fallback, where the two
  // implementations previously used different counters).
  const AGREEMENT_MD =
    `# 🚀 Getting Started\n\n## Setup\n\n## Setup\n\n## Setup\n\n## !!!\n\n## Weird — punct!, chars?\n`

  it('renderer-generated heading ids equal extractSections ids for the same markdown', async () => {
    const sections = extractSections(AGREEMENT_MD, { maxLevel: 2 })
    const container = await renderStable(<SimpleMarkdownRenderer content={AGREEMENT_MD} />)
    const renderedIds = Array.from(container.querySelectorAll('h1, h2')).map((el) => el.id)
    expect(renderedIds).toEqual(sections.map((s) => s.id))
    expect(sections).toMatchSnapshot('extracted-sections')
  })

  it('heading ids are STABLE across re-renders of the same content', async () => {
    const idsOf = (c: HTMLElement) =>
      Array.from(c.querySelectorAll('h1, h2')).map((el) => el.id)

    // Two independent mounts must agree…
    const first = await renderStable(<SimpleMarkdownRenderer content={AGREEMENT_MD} />)
    const firstIds = idsOf(first)
    const second = await renderStable(<SimpleMarkdownRenderer content={AGREEMENT_MD} />)
    expect(idsOf(second)).toEqual(firstIds)

    // …and so must repeated render passes of the SAME instance. Before the
    // per-pass counter reset this produced `setup-4`, `setup-5`, … on every
    // re-render, silently breaking every `#anchor` deep link.
    let container!: HTMLElement
    let rerender!: (ui: React.ReactElement) => void
    await act(async () => {
      const result = render(<SimpleMarkdownRenderer content={AGREEMENT_MD} />)
      container = result.container
      rerender = result.rerender
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(idsOf(container)).toEqual(firstIds)

    for (let pass = 0; pass < 3; pass++) {
      await act(async () => {
        // A fresh `brokenLinks` array each time is exactly what a parent
        // re-render looks like — it must not renumber anything.
        rerender(<SimpleMarkdownRenderer content={AGREEMENT_MD} brokenLinks={[]} />)
        await new Promise((r) => setTimeout(r, 0))
      })
      expect(idsOf(container), `pass ${pass}`).toEqual(firstIds)
    }
  })

  // --- round-2: the ids must be PURE ---------------------------------------
  it('ids are identical under a StrictMode double render', async () => {
    // Heading renderers are element types, re-rendered INDEPENDENTLY of the
    // parent that used to `reset()` the counter — so StrictMode's second
    // invocation suffixed every id with `-2` in dev and broke
    // extractor↔renderer parity. The pure line-keyed map is immune.
    const plain = await renderStable(<SimpleMarkdownRenderer content={AGREEMENT_MD} />)
    const plainIds = Array.from(plain.querySelectorAll('h1, h2')).map((el) => el.id)

    const strict = await renderStable(
      <React.StrictMode>
        <SimpleMarkdownRenderer content={AGREEMENT_MD} />
      </React.StrictMode>,
    )
    const strictIds = Array.from(strict.querySelectorAll('h1, h2')).map((el) => el.id)
    expect(strictIds).toEqual(plainIds)
  })

  it('emits NO duplicate ids mid-stream, where completed blocks are memoized', async () => {
    // A memoized completed block does NOT re-render on the pass that used to
    // reset the counter, so block 0 kept `id="setup"` while the re-rendered
    // tail re-derived `setup` from an empty counter — two live `id="setup"`
    // in the DOM, and `#setup` resolving to the wrong node for the whole
    // stream.
    const STREAM_MD = '## Setup\n\nfirst body\n\n## Setup\n\nsecond body\n\ntail text'

    let container!: HTMLElement
    let rerender!: (ui: React.ReactElement) => void
    await act(async () => {
      const result = render(<SimpleMarkdownRenderer content={STREAM_MD} streaming />)
      container = result.container
      rerender = result.rerender
      await new Promise((r) => setTimeout(r, 0))
    })

    const idsOf = () => Array.from(container.querySelectorAll('h1, h2, h3')).map((el) => el.id)
    expect(idsOf()).toEqual(['setup', 'setup-2'])

    // Grow the tail token-by-token; the completed blocks stay memoized.
    for (const suffix of [' and', ' and more', ' and more words']) {
      await act(async () => {
        rerender(<SimpleMarkdownRenderer content={`${STREAM_MD}${suffix}`} streaming />)
        await new Promise((r) => setTimeout(r, 0))
      })
      const ids = idsOf()
      expect(ids, `after "${suffix}"`).toEqual(['setup', 'setup-2'])
      expect(new Set(ids).size, 'no duplicate DOM ids').toBe(ids.length)
    }

    // …and the settled whole-document parse agrees with the extractor.
    const done = await renderStable(<SimpleMarkdownRenderer content={STREAM_MD} />)
    expect(Array.from(done.querySelectorAll('h1, h2')).map((el) => el.id)).toEqual(
      extractSections(STREAM_MD, { maxLevel: 2 }).map((s) => s.id),
    )
  })

  // --- round-3: producer/consumer scanner parity -------------------------
  it('agrees with the extractor across fence, container and setext shapes', async () => {
    // Every line here was a DRIFT between the two implementations:
    //  - a `~~~` fence: the extractor toggled only on '```', so `## Fenced`
    //    became a phantom section with no matching renderer id;
    //  - an indented / longer-run fence: same class;
    //  - `> ## Quoted` and `- ## Listed`: real <h2>s in mdast that the
    //    renderer's column-0..3 scan missed entirely, so BOTH of two
    //    identical ones fell to the suffix-free fallback and emitted
    //    DUPLICATE DOM ids;
    //  - `Setext Title\n---`: a real <h2> the renderer never scanned AND
    //    which flipped the extractor into a phantom "YAML block" that
    //    swallowed every heading after it.
    const DRIFT_MD = [
      '# Top',
      '',
      '~~~text',
      '## Fenced Not A Heading',
      '~~~',
      '',
      '   ```',
      '## Also Fenced',
      '   ```',
      '',
      'Setext Title',
      '---',
      '',
      '> ## Quoted',
      '',
      '- ## Listed',
      '',
      '> ## Quoted',
      '',
      '## Tail',
      '',
    ].join('\n')

    const sections = extractSections(DRIFT_MD, { maxLevel: 2 })
    const container = await renderStable(<SimpleMarkdownRenderer content={DRIFT_MD} />)
    const renderedIds = Array.from(container.querySelectorAll('h1, h2')).map((el) => el.id)

    expect(renderedIds).toEqual(sections.map((s) => s.id))
    expect(new Set(renderedIds).size, 'no duplicate DOM ids').toBe(renderedIds.length)
    expect(renderedIds, 'fenced headings contribute NO id').not.toContain('fenced-not-a-heading')
    expect(sections).toMatchSnapshot('drift-sections')
  })

  // --- round-4: the setext scan must match mdast EXACTLY ------------------
  // The scanner is a line-based approximation of what remark will parse. Where
  // it diverges, the renderer's line-keyed id lookup misses (dead deep link)
  // or the extractor publishes a phantom TOC entry. These pin the three
  // divergences against remark itself rather than against a hand-written
  // expectation.
  describe('setext scanning matches mdast', () => {
    const mdastHeadings = (md: string) => {
      const tree = unified().use(remarkParse).parse(md) as any
      const out: Array<{ line: number; level: number }> = []
      const walk = (n: any) => {
        if (n.type === 'heading') out.push({ line: n.position.start.line, level: n.depth })
        for (const child of n.children ?? []) walk(child)
      }
      walk(tree)
      return out
    }
    const scanned = (md: string) =>
      scanHeadings(md).map((h) => ({ line: h.line, level: h.level }))

    it('multi-line setext is ONE heading at the run\'s FIRST line', () => {
      const md = 'Foo\nbar\n===\n'
      // mdast: {line:1, depth:1, text:"Foo\nbar"}. The scanner used to record
      // only the LAST paragraph line ({line:2, text:"bar"}), so the renderer's
      // lookup missed and fell back to a slug of the rendered children
      // (`foo-bar`) while the extractor published `bar`.
      expect(scanned(md)).toEqual(mdastHeadings(md))
      expect(scanHeadings(md)[0].text).toBe('Foo\nbar')
      expect(extractSections(md).map((s) => s.id)).toEqual(['foo-bar'])
    })

    it('container-nested setext IS a heading', () => {
      const md = '> Quote title\n> ---\n'
      // A real h2 in mdast; the container-prefix guard used to kill the
      // candidate, so it was invisible to the TOC.
      expect(scanned(md)).toEqual(mdastHeadings(md))
      expect(extractSections(md).map((s) => s.id)).toEqual(['quote-title'])
    })

    it('a `---` inside a raw HTML block is NOT a setext underline', () => {
      const md = '<div>\nText\n---\n</div>\n'
      // mdast emits nothing (the whole thing is one HTML block); the scanner
      // used to publish a phantom `Text` h2.
      expect(mdastHeadings(md)).toEqual([])
      expect(scanned(md)).toEqual([])
      expect(extractSections(md)).toEqual([])
    })

    it('an underline with a DIFFERENT container prefix is a thematic break', () => {
      const md = '> Quote\n\n---\n'
      expect(scanned(md)).toEqual(mdastHeadings(md))
      expect(scanned(md)).toEqual([])
    })

    it('renderer ids agree with the extractor for multi-line setext', async () => {
      const md = 'Foo\nbar\n===\n\nbody\n'
      const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
      expect(Array.from(container.querySelectorAll('h1, h2')).map((el) => el.id)).toEqual(
        extractSections(md, { maxLevel: 2 }).map((s) => s.id),
      )
    })
  })

  it('honors an AUTHORED anchor on a raw-HTML heading', async () => {
    // The sanitize schema allows `id` and disables clobbering precisely so
    // hand-picked anchors survive; the renderer then overwrote them with the
    // slug of the heading text, silently breaking every deep link to them.
    const md = '<h2 id="pricing-faq">Pricing</h2>\n\nbody'
    const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(container.querySelector('h2')?.id).toBe('pricing-faq')
  })

  it('strips inline markdown from heading text before slugifying (extractor parity)', async () => {
    const md = '## **Bold** Setup\n\n## `code` Heading\n'
    const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(Array.from(container.querySelectorAll('h2')).map((el) => el.id)).toEqual(
      extractSections(md, { maxLevel: 2 }).map((s) => s.id),
    )
  })
})
