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
import { __buildCloserHaystackForTest, escapeUnknownHtmlTags } from '../markdown/sanitize'
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
  // Round-6 SECURITY: the mask understood ONLY column-0..3 ```/~~~ fences,
  // inline code and attribute runs — so a `</textarea>` in ANY other ordinary
  // form of code satisfied "is closed later" and the prose opener stayed live.
  // All five shapes below were reproduced end-to-end as a live editable
  // textarea containing the rest of the message. The mask's block-level code
  // regions are now derived from `createFenceTracker` (plus indented,
  // blockquoted and commented code) instead of from a flat regex.
  //
  // (a) a blockquoted fence — an utterly ordinary chat answer.
  'rawtext-closer-in-blockquoted-fence-does-not-unescape':
    'The <textarea> element is a form control whose closing tag matters.\n\n> ```html\n> <textarea name="bio">hello</textarea>\n> ```\n\n## After heading\n',
  // (b) an indented (4-space / tab) code block. `FENCE_RE` caps fence indent at
  //     3 spaces by design, so the tracker never sees these lines at all.
  'rawtext-closer-in-indented-code-does-not-unescape':
    'Explaining <textarea> in prose.\n\n## After heading\n\n    </textarea>\n\ntail\n',
  'rawtext-closer-in-tab-indented-code-does-not-unescape':
    'Explaining <textarea> in prose.\n\n## After heading\n\n\t</textarea>\n\ntail\n',
  // (c) a fence indented into a list-item content column.
  'rawtext-closer-in-list-indented-fence-does-not-unescape':
    'Explaining <textarea> in prose.\n\n## After heading\n\n- item\n\n      ```html\n      </textarea>\n      ```\n\ntail\n',
  // (d) an HTML comment. parse5 consumes it as comment data; it is not a closer.
  'rawtext-closer-in-html-comment-does-not-unescape':
    'Explaining <textarea> in prose.\n\n## After heading\n\n<!-- </textarea> -->\n\ntail\n',
  // (e) an INFO-STRING closer. CommonMark forbids an info string on a closing
  //     fence, but `PROTECTED_SPAN_RE`'s closer alternative allowed `[^\n]*` —
  //     so the masked span ended at the ```html line and the real code content
  //     after it went unmasked. `createFenceTracker` gets this right.
  'rawtext-closer-after-info-string-closer-does-not-unescape':
    'Explaining <textarea> in prose.\n\n## After heading\n\n```js\nx\n```html\n</textarea>\n```\n\ntail\n',
  // Round-7 SECURITY (the class-closing one): the carve (`PROTECTED_SPAN_RE`)
  // and the mask (tracker-derived) run DIFFERENT engines, so the carve can
  // protect a region the mask correctly blanked — and a protected span is
  // pushed through VERBATIM, so a live RAWTEXT opener inside it never reaches
  // `escapeOutsideFences` at all. Here the regex's closer alternative accepts an
  // info string, so its first span ends early at the ```js line, it desyncs, and
  // it opens a NEW span at the `~~~` line (ordinary text to CommonMark) that
  // runs past remark's real closer and shelters the `<textarea>`. parse5 then
  // swallowed `hello`, `~~~` and `after`. The carve is now the INTERSECTION of
  // carve and mask, so over-detection by EITHER engine can only cause escaping.
  'mismatched-fence-carve-does-not-shelter-opener':
    '```\n```js\n~~~\n```\n<textarea>\nhello\n~~~\nafter\n',
  // Round-7 REGRESSION: `blankComments` scanned the UNMASKED copy, so a `<!--`
  // written INSIDE code blanked everything after it to EOF. Every other pass
  // scans the unmasked copy on purpose (`INLINE_CODE_RE` would corrupt a fence
  // scan), but for comments that reasoning inverts: a `<!--` inside a code
  // region is not a comment start. Both shapes rendered a REAL `<textarea>`
  // before the round-6 mask work, and must keep doing so.
  'comment-marker-in-inline-code-does-not-blank-to-eof':
    'Use `<!--` to start a comment.\n\n<textarea>hi</textarea>\n',
  'truncated-comment-in-fence-does-not-blank-to-eof':
    '```html\n<!-- todo\n```\n\n<textarea>a</textarea>\n',
  // Round-7: `blankIndentedCode` applied a flat 4-space threshold, so a LIST
  // ITEM's continuation paragraph (content indent 4 under `1.  `, 2 under `- `)
  // was blanked as code — the closer vanished from the haystack and the opener
  // escaped. Under CommonMark these are paragraph lines and the element is real.
  'list-continuation-textarea-stays-live-ordered':
    '1.  Here is a form:\n\n    <textarea>\n    </textarea>\n',
  'list-continuation-textarea-stays-live-bullet': '- item\n\n    <textarea>x</textarea>\n',
  // Round-9 SECURITY (the residual fail-open of the round-7 intersection
  // guard): the guard only reconciles DISAGREEMENT between carve and mask.
  // When BOTH engines over-detect the SAME region it is a no-op —
  // `isMaskedBlank` is true, the span is pushed VERBATIM, and a live RAWTEXT
  // opener inside it never reaches `escapeOutsideFences`. CommonMark says an
  // HTML block (type 1 `<pre>`/`<details>`, type 6 `<div>`) runs to its
  // terminator, so a ``` line inside one is HTML CONTENT, not a fence — and
  // neither engine models HTML blocks. Both opened a bogus fence at the same
  // line, so `<textarea>` was sheltered and the rest of the message became its
  // editable value. The carve now additionally requires that a protected span
  // contain no UNBALANCED RAWTEXT opener (a span is by definition
  // self-contained code, so any opener inside must be balanced within it).
  'rawtext-opener-in-html-block-div-not-sheltered':
    'intro\n\n<div>\n```\n<textarea>\n```\n</div>\n\n## After heading\n\nsecret tail\n',
  'rawtext-opener-in-html-block-pre-not-sheltered':
    'intro\n\n<pre>\n```\n<textarea>\n```\n</pre>\n\n## After heading\n\nsecret tail\n',
  'rawtext-opener-in-html-block-details-not-sheltered':
    'intro\n\n<details>\n```\n<textarea>\n```\n</details>\n\n## After heading\n\nsecret tail\n',
  // Round-11 SECURITY (the one that defeated the ENTIRE swallow defense): HTML
  // IGNORES the self-closing flag on non-void, non-foreign elements, so parse5
  // tokenizes `<textarea/>` as a START tag and enters RAWTEXT exactly like
  // `<textarea>`. Both RAWTEXT guards nevertheless keyed on `selfClose === ''`
  // and treated the self-closed spelling as "not an opener", so
  // `escapeUnknownHtmlTags` returned every input below COMPLETELY untouched —
  // no `&lt;` anywhere. Reproduced end-to-end through `SimpleMarkdownRenderer`:
  // `<textarea/>` rendered a live textarea and the `## After heading` below it
  // stopped being a heading; the spaced form swallowed the list too. It also
  // defeated the round-9 HTML-block fix, whose fixtures only ever used the
  // non-self-closing spelling. `RAWTEXT_TAGS` has no void members, so nothing
  // legitimate self-closes — both guards now count the self-closed form as an
  // opener.
  'rawtext-self-closing-textarea-escaped':
    'Hello\n\n<textarea/>\n\n## After heading\n\n- item\n',
  'rawtext-self-closing-spaced-textarea-escaped':
    'Hello\n\n<textarea />\n\n## After heading\n\n- item\n',
  'rawtext-self-closing-iframe-escaped': 'Hello\n\n<iframe/>\n\n## After heading\n\n- item\n',
  'rawtext-self-closing-title-escaped': 'Hello\n\n<title/>\n\n## After heading\n\n- item\n',
  'rawtext-self-closing-textarea-inline-escaped':
    'Hello <textarea/> world\n\n## After heading\n',
  'rawtext-self-closing-opener-in-html-block-div-not-sheltered':
    'intro\n\n<div>\n```\n<textarea/>\n```\n</div>\n\n## After heading\n\nsecret tail\n',
  // Round-11 REGRESSION (user-visible, introduced by round-9): the CARVE
  // BALANCE GUARD was gated on BOTH `PROTECTED_SPAN_RE` alternatives, including
  // INLINE CODE — where it can close no fail-open at all (remark emits an inline
  // span as an `inlineCode` TEXT node, so parse5 never tokenizes it) and does
  // real damage: entity refs are not recognized inside code spans, so the
  // escaped `&lt;title&gt;` is shown to the reader LITERALLY. Naming a RAWTEXT
  // tag in inline code is the single most common way a docs answer mentions one,
  // and it never closes. The guard is now scoped to the FENCE alternative.
  'inline-code-rawtext-title-not-escaped': 'Use the `<title>` element for page titles.',
  'inline-code-rawtext-textarea-not-escaped': 'The `<textarea>` element is a form control.',
  // Round-9 REGRESSION (introduced by round-7's list-aware indent threshold):
  // `blankIndentedCode` walked lines built from the UNMASKED copy, so a `- x`
  // line INSIDE a fence still pushed a list content column. A later top-level
  // indented-code line at column 4 then failed `indent >= top + 4`, was NOT
  // blanked, and its code-sample `</textarea>` satisfied `hasLaterCloser` —
  // leaving the prose opener LIVE. The walk now re-derives its lines from the
  // CURRENT mask, so fence-blanked lines are all-spaces and push nothing.
  'list-marker-inside-fence-does-not-shift-indent-columns':
    'A <textarea>\n\n```\n- x\n  ```\n\n    </textarea>\n',
  'list-marker-inside-fence-html-block-combo':
    '<div>\n<textarea>\n</div>\n\n```\n- x\n  ```\n\n    </textarea>\n\n# Heading after\n\nBody after.\n',
  // Round-9 CORRECTNESS: CommonMark clamps a list item's content column to
  // `markerEnd + 1` when the first block starts MORE than 4 spaces after the
  // marker (the remainder is indented code INSIDE the item). The walk took the
  // literal column, so under `-` + six spaces a column-7 indented-code line
  // was not blanked and its `</textarea>` kept the prose opener live.
  'wide-list-marker-gap-clamps-content-column':
    'Explaining <textarea> in HTML.\n\n-      foo\n\n       </textarea>\n\n## After heading\n',
  // Round-6 CARVE TRADEOFF (pinned, not fixed): the mask's tracker-derived
  // regions are deliberately NOT fed to the escaping carve — the tracker
  // OVER-detects a ``` line inside an open raw-HTML block, which in the carve
  // means "not escaped", a fail-OPEN. So an AUTHORED EOF-terminated fence body
  // is still unprotected and its `<their>` renders as escaped source text. That
  // is cosmetic; the alternative is a swallow. The snapshot makes it visible.
  'unclosed-fence-body-renders-escaped': 'intro\n\n```html\n<their>x</their>\n',
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

  // Round-6: every ordinary form of CODE must hide a `</textarea>` from the
  // closer search. Each of these rendered a LIVE editable textarea containing
  // the rest of the message before the mask became tracker-derived.
  it.each([
    'rawtext-closer-in-blockquoted-fence-does-not-unescape',
    'rawtext-closer-in-indented-code-does-not-unescape',
    'rawtext-closer-in-tab-indented-code-does-not-unescape',
    'rawtext-closer-in-list-indented-fence-does-not-unescape',
    'rawtext-closer-in-html-comment-does-not-unescape',
    'rawtext-closer-after-info-string-closer-does-not-unescape',
  ])('escapes the prose opener when the only closer is code: %s', async (name) => {
    const md = SHARED_FIXTURES[name]
    const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(container.querySelectorAll('textarea').length, name).toBe(0)
    // …and the document after the opener is still structured markdown.
    expect(container.querySelector('h2')?.textContent, name).toBe('After heading')
  })

  // Round-7: the carve must never shelter an opener the mask blanked. The
  // protected set is the INTERSECTION of carve and mask, so a span the mask
  // disagrees with is routed through `escapeOutsideFences` instead of being
  // pushed verbatim.
  it('does not shelter a live opener inside a mismatched carve span', async () => {
    const md = SHARED_FIXTURES['mismatched-fence-carve-does-not-shelter-opener']
    const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(container.querySelectorAll('textarea').length).toBe(0)
    // The text after the opener survives instead of becoming a textarea value.
    expect(container.textContent).toContain('after')
  })

  // Round-9: BOTH engines over-detect a fence inside an HTML block, so the
  // intersection guard is a no-op there. A protected span is self-contained
  // code by definition, so an UNBALANCED RAWTEXT opener inside one means the
  // span is not really code — route it through the escaper.
  it.each([
    'rawtext-opener-in-html-block-div-not-sheltered',
    'rawtext-opener-in-html-block-pre-not-sheltered',
    'rawtext-opener-in-html-block-details-not-sheltered',
  ])('does not shelter an opener inside an HTML block: %s', async (name) => {
    const container = await renderStable(<SimpleMarkdownRenderer content={SHARED_FIXTURES[name]} />)
    expect(container.querySelectorAll('textarea').length, name).toBe(0)
    expect(container.querySelector('h2')?.textContent, name).toBe('After heading')
    expect(container.textContent, name).toContain('secret tail')
  })

  // Round-11: HTML ignores the self-closing flag on non-void, non-foreign
  // elements, so `<textarea/>` is a START tag and enters RAWTEXT exactly like
  // `<textarea>`. Every RAWTEXT fixture must therefore hold in BOTH spellings.
  it.each([
    'rawtext-self-closing-textarea-escaped',
    'rawtext-self-closing-spaced-textarea-escaped',
    'rawtext-self-closing-iframe-escaped',
    'rawtext-self-closing-title-escaped',
  ])('escapes a SELF-CLOSING rawtext opener: %s', async (name) => {
    const container = await renderStable(<SimpleMarkdownRenderer content={SHARED_FIXTURES[name]} />)
    expect(container.querySelectorAll('textarea').length, name).toBe(0)
    expect(container.querySelectorAll('iframe').length, name).toBe(0)
    expect(container.querySelector('h2')?.textContent, name).toBe('After heading')
    expect(container.querySelectorAll('li').length, name).toBe(1)
  })

  it('escapes a self-closing rawtext opener written INLINE in prose', async () => {
    const container = await renderStable(
      <SimpleMarkdownRenderer content={SHARED_FIXTURES['rawtext-self-closing-textarea-inline-escaped']} />,
    )
    expect(container.querySelectorAll('textarea').length).toBe(0)
    expect(container.textContent).toContain('<textarea/>')
    expect(container.querySelector('h2')?.textContent).toBe('After heading')
  })

  it('does not shelter a SELF-CLOSING opener inside an HTML block', async () => {
    const container = await renderStable(
      <SimpleMarkdownRenderer
        content={SHARED_FIXTURES['rawtext-self-closing-opener-in-html-block-div-not-sheltered']}
      />,
    )
    expect(container.querySelectorAll('textarea').length).toBe(0)
    expect(container.querySelector('h2')?.textContent).toBe('After heading')
    expect(container.textContent).toContain('secret tail')
  })

  // Round-11: the WHOLE swallow corpus, re-run in the SELF-CLOSING spelling.
  // Every fixture below is one whose defense is "the prose opener must escape";
  // rewriting each bare RAWTEXT opener to `<tag/>` must not change that, since
  // parse5 treats the two spellings identically. This is the sweep that would
  // have caught the round-9 HTML-block fixtures passing for the wrong reason.
  const SWALLOW_CORPUS = [
    'rawtext-closer-in-fence-does-not-unescape',
    'rawtext-closer-in-inline-code-does-not-unescape',
    'rawtext-closer-in-attribute-does-not-unescape',
    'rawtext-title-closer-in-fence-does-not-unescape',
    'rawtext-mask-survives-turkish-dotted-i',
    'rawtext-closer-in-unclosed-fence-does-not-unescape',
    'rawtext-closer-in-blockquoted-fence-does-not-unescape',
    'rawtext-closer-in-indented-code-does-not-unescape',
    'rawtext-closer-in-tab-indented-code-does-not-unescape',
    'rawtext-closer-in-list-indented-fence-does-not-unescape',
    'rawtext-closer-in-html-comment-does-not-unescape',
    'rawtext-closer-after-info-string-closer-does-not-unescape',
    'mismatched-fence-carve-does-not-shelter-opener',
    'rawtext-opener-in-html-block-div-not-sheltered',
    'rawtext-opener-in-html-block-pre-not-sheltered',
    'rawtext-opener-in-html-block-details-not-sheltered',
    'list-marker-inside-fence-does-not-shift-indent-columns',
    'list-marker-inside-fence-html-block-combo',
    'wide-list-marker-gap-clamps-content-column',
  ]
  // Bare opener → self-closed opener. Closers (`</tag>`), openers that already
  // carry attributes, and openers whose closer sits on the SAME line (a paired
  // inline element, as in the Turkish-`İ` fixture) are left alone — rewriting
  // those would change what the fixture is about rather than its spelling.
  const selfClose = (md: string) =>
    md.replace(
      /<(title|textarea|iframe|xmp|noembed|noframes|plaintext)>(?![^\n]*<\/\1>)/gi,
      '<$1/>',
    )

  const RAWTEXT_SELECTORS = ['textarea', 'iframe', 'title', 'xmp', 'noembed', 'noframes', 'plaintext']
  const rawtextCounts = (el: HTMLElement) =>
    RAWTEXT_SELECTORS.map((t) => `${t}:${el.querySelectorAll(t).length}`).join(' ')

  it.each(SWALLOW_CORPUS)('swallow corpus holds in the self-closing spelling: %s', async (name) => {
    const bare = SHARED_FIXTURES[name]
    const md = selfClose(bare)
    expect(md, name).not.toBe(bare) // the rewrite actually applied
    const bareEl = await renderStable(<SimpleMarkdownRenderer content={bare} />)
    const selfEl = await renderStable(<SimpleMarkdownRenderer content={md} />)
    // Spelling-independence: parse5 treats `<tag/>` as a start tag, so the two
    // spellings must yield the same live RAWTEXT elements…
    expect(rawtextCounts(selfEl), name).toBe(rawtextCounts(bareEl))
    // …and the same document structure below the opener (no swallow).
    expect(selfEl.querySelectorAll('h1,h2,h3,li,p').length, name).toBe(
      bareEl.querySelectorAll('h1,h2,h3,li,p').length,
    )
  })

  // Round-11: the balance guard must NOT touch inline code. An inline span can
  // shelter nothing (remark emits it as an `inlineCode` text node), and entity
  // refs are not recognized inside code spans — so escaping there is always
  // visible to the reader as the literal text `&lt;title&gt;`.
  it.each([
    ['inline-code-rawtext-title-not-escaped', '<title>'],
    ['inline-code-rawtext-textarea-not-escaped', '<textarea>'],
  ])('keeps a rawtext tag named in inline code verbatim: %s', async (name, tag) => {
    const container = await renderStable(<SimpleMarkdownRenderer content={SHARED_FIXTURES[name]} />)
    const code = container.querySelector('code')
    expect(code?.textContent, name).toBe(tag)
    expect(container.textContent, name).not.toContain('&lt;')
    // …and the inline span still shelters nothing live.
    expect(container.querySelectorAll('textarea').length, name).toBe(0)
  })

  // Round-11 SECURITY: `TAG_LIKE_REGEX` hard-bounds its attribute run at 4096
  // chars (ReDoS hardening). An attribute run LONGER than that made the tag
  // fail to match AT ALL, so neither the allowlist nor the RAWTEXT closer check
  // ever ran and a live opener reached the DOM verbatim. Kept out of
  // SHARED_FIXTURES only to spare the snapshots ~20KB of filler.
  it.each([
    ['iframe', `Hello\n\n<iframe src="${'b'.repeat(5000)}">\n\n## After heading\n\n- item\n`],
    ['textarea', `Hello\n\n<textarea ${'a'.repeat(5000)}>\n\n## After heading\n\n- item\n`],
    ['unknown', `Hello\n\n<their ${'a'.repeat(5000)}>\n\n## After heading\n\n- item\n`],
  ])('escapes a tag whose attribute run exceeds the regex cap: %s', async (tag, md) => {
    const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(container.querySelectorAll(tag).length, tag).toBe(0)
    expect(container.querySelector('h2')?.textContent, tag).toBe('After heading')
    expect(container.querySelectorAll('li').length, tag).toBe(1)
  })

  // …and the fallback must not double-escape what the main pass already handled.
  it('the over-long-tag fallback does not double-escape ordinary tags', () => {
    for (const src of [
      'a <their>b</their> c',
      'a <textarea>b</textarea> c',
      '<div class="x">y</div>',
      'Hello <textarea/> world',
      'plain text with no tags at all',
      '`<title>` in code',
    ]) {
      expect(escapeUnknownHtmlTags(src), src).not.toContain('&amp;lt;')
    }
  })

  // Round-9: the indented-code walk must see the CURRENT mask, so a list marker
  // written inside a fence cannot shift the content-column stack.
  it('a list marker inside a fence does not unblank later indented code', async () => {
    const container = await renderStable(
      <SimpleMarkdownRenderer
        content={SHARED_FIXTURES['list-marker-inside-fence-does-not-shift-indent-columns']}
      />,
    )
    expect(container.querySelectorAll('textarea').length).toBe(0)
  })

  it('survives the HTML-block + in-fence-list-marker combination', async () => {
    const container = await renderStable(
      <SimpleMarkdownRenderer content={SHARED_FIXTURES['list-marker-inside-fence-html-block-combo']} />,
    )
    expect(container.querySelectorAll('textarea').length).toBe(0)
    expect(container.querySelector('h1')?.textContent).toBe('Heading after')
    expect(container.textContent).toContain('Body after.')
  })

  // Round-9: CommonMark clamps the item content column when the marker is
  // followed by more than 4 spaces.
  it('clamps a list content column when the marker gap exceeds 4 spaces', async () => {
    const container = await renderStable(
      <SimpleMarkdownRenderer content={SHARED_FIXTURES['wide-list-marker-gap-clamps-content-column']} />,
    )
    expect(container.querySelectorAll('textarea').length).toBe(0)
    expect(container.querySelector('h2')?.textContent).toBe('After heading')
  })

  // Round-7: a `<!--` inside code is not a comment start. Both of these blanked
  // the rest of the document (and escaped a perfectly valid element) when
  // `blankComments` scanned the unmasked copy.
  it.each([
    'comment-marker-in-inline-code-does-not-blank-to-eof',
    'truncated-comment-in-fence-does-not-blank-to-eof',
  ])('a `<!--` inside code does not disable later closers: %s', async (name) => {
    const container = await renderStable(<SimpleMarkdownRenderer content={SHARED_FIXTURES[name]} />)
    expect(container.querySelectorAll('textarea').length, name).toBe(1)
  })

  // Round-7: list-item continuation lines are paragraphs, not indented code.
  it.each([
    'list-continuation-textarea-stays-live-ordered',
    'list-continuation-textarea-stays-live-bullet',
  ])('keeps a list-continuation <textarea> live: %s', async (name) => {
    const container = await renderStable(<SimpleMarkdownRenderer content={SHARED_FIXTURES[name]} />)
    expect(container.querySelectorAll('textarea').length, name).toBe(1)
  })

  // The blockquote pass strips the `>` prefix and runs a NESTED tracker rather
  // than blanking every quoted line, precisely so a legitimately PAIRED
  // `<textarea>` inside a blockquote keeps rendering as a real element.
  it('keeps a properly paired <textarea> inside a blockquote live', async () => {
    const md = '> quoted intro\n>\n> <textarea>edit me</textarea>\n\n## After heading\n'
    const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(container.querySelectorAll('textarea').length).toBe(1)
    expect(container.querySelector('h2')?.textContent).toBe('After heading')
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
      // The h2 assertion alone is NOT enough: a swallow that starts after the
      // heading leaves the <h2> intact while the rest of the message becomes a
      // live textarea value. Pin the absence of the swallow itself.
      const textareas = Array.from(container.querySelectorAll('textarea'))
      expect(textareas.length, `cut=${cut}`).toBe(0)
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
