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
  it('renderer-generated heading ids equal extractSections ids for the same markdown', async () => {
    const md = `# 🚀 Getting Started\n\n## Setup\n\n## Setup\n\n## Weird — punct!, chars?\n`
    const sections = extractSections(md, { maxLevel: 2 })
    const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
    const renderedIds = Array.from(container.querySelectorAll('h1, h2')).map((el) => el.id)
    expect(renderedIds).toEqual(sections.map((s) => s.id))
    expect(sections).toMatchSnapshot('extracted-sections')
  })
})
