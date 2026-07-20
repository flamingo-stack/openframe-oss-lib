/**
 * Phase-0 GOLDEN CHARACTERIZATION TESTS for the markdown renderer unification.
 *
 * These snapshots capture the CURRENT output of `SimpleMarkdownRenderer` and
 * `RichMarkdownRenderer` over a fixture corpus BEFORE the unified engine
 * refactor. After the refactor the same tests must produce identical
 * snapshots, except for deltas explicitly reviewed in the migration plan
 * (blockquote bg token, ODS `article` typography preset, sanitizer applied
 * to Rich, and the code-block font: the old inline "JetBrains Mono", "SF
 * Mono", Consolas stack is now the ODS `font-mono` class — see the
 * ODS-TOKENS note in ../markdown/base-components.tsx).
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
import {
  __buildCloserHaystackForTest,
  __findInlineCodeRangesForTest,
  escapeUnknownHtmlTags,
} from '../markdown/sanitize'
import { splitStreamingBlocks } from '../markdown/streaming'
import { isBlankLine } from '../../../utils/markdown-fences'
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
  // (c2) Round-17 SECURITY: the SAME fence, one container deeper — a list item
  //      INSIDE A BLOCKQUOTE. `blankQuotedCode`'s flush ran the fence + indented
  //      passes over the quote-stripped run but NOT `blankListItemCode`, while
  //      `blankListItemCode` DID call `blankQuotedCode`; that asymmetry was the
  //      hole. `FENCE_RE` caps fence indent at 3 ABSOLUTE columns, so at a
  //      quote-relative content column of 4 the nested tracker misses the fence,
  //      and `blankIndentedCode`'s list-aware threshold (`contentCol + 4` = 8)
  //      does not reach it either — the fence was seen by NO pass. Reproduced
  //      live: one editable `<textarea>` swallowing the quoted example, with
  //      `escapeUnknownHtmlTags` returning the input BYTE-IDENTICAL. The same
  //      shape reproduced for `<iframe>`, for `> -   ` and `> -\t`, and at
  //      quote depth 2 — all covered by the container × container sweep below.
  'rawtext-closer-in-quoted-list-indented-fence-does-not-unescape':
    'The <textarea> element explained.\n\n> 1.  Example:\n>\n>     ```html\n>     </textarea>\n>     ```\n\n## After heading\n\nsecret tail\n',
  // (c3) Round-18 SECURITY, the EIGHTH instance and the SHALLOWEST yet — ZERO
  //      nesting depth. `blankListItemCode` read the content-column stack BEFORE
  //      pushing the current line's own marker, so the MARKER LINE never entered
  //      a run and a fence opened ON it was invisible to every pass: `FENCE_RE`'s
  //      3-column absolute cap misses it and `blankIndentedCode`'s
  //      `contentCol + 4` threshold overshoots it. The run then began AFTER the
  //      opener, so the item's CLOSING fence read as an `open` to the nested
  //      tracker, which blanked to EOF while leaving the code BODY live.
  //      `escapeUnknownHtmlTags` returned the input BYTE-IDENTICAL and the
  //      renderer emitted a live editable `<textarea>` swallowing the prose.
  //      Reproduced at every marker spelling and for `<iframe>`.
  'rawtext-closer-in-marker-line-fence-does-not-unescape':
    'The <textarea> element explained.\n\n-   ```html\n    </textarea>\n    ```\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-marker-line-ordered-fence-does-not-unescape':
    'The <textarea> element explained.\n\n1.  ```html\n    </textarea>\n    ```\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-marker-line-tab-fence-does-not-unescape':
    'The <textarea> element explained.\n\n-\t```html\n    </textarea>\n    ```\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-quoted-marker-line-fence-does-not-unescape':
    'The <textarea> element explained.\n\n> -   ```html\n>     </textarea>\n>     ```\n\n## After heading\n\nsecret tail\n',
  'rawtext-iframe-closer-in-marker-line-fence-does-not-unescape':
    'The <iframe> element explained.\n\n-   ```html\n    </iframe>\n    ```\n\n## After heading\n\nsecret tail\n',
  // CONTROL for the shape above: the SAME fence one line LOWER (a continuation
  // line) was always masked correctly. It isolates the defect to "a block opened
  // ON the marker line", and it must keep working after the reorder.
  'rawtext-closer-in-continuation-line-fence-does-not-unescape':
    'The <textarea> element explained.\n\n-   item\n\n    ```html\n    </textarea>\n    ```\n\n## After heading\n\nsecret tail\n',
  // Round-18 SECURITY: a CommonMark code span CROSSES LINE BREAKS, and neither
  // the mask's inline scan nor `PROTECTED_SPAN_RE` did — both were strictly
  // per-line. So `` `foo\n</textarea>` `` left its closer visible in the
  // haystack, `hasLaterCloser` returned true and the prose opener stayed LIVE.
  // This is the shape that is not a CONTAINER at all, so no container sweep
  // could reach it; the scan unit is now the paragraph segment. The renderer
  // emitting `<code>foo </textarea></code>` is the proof the closer is a sample.
  'rawtext-closer-in-multiline-code-span-does-not-unescape':
    'The <textarea> element explained.\n\nUse `foo\n</textarea>` today.\n\n## After heading\n\nsecret tail\n',
  'rawtext-iframe-closer-in-multiline-code-span-does-not-unescape':
    'The <iframe> element explained.\n\nUse `foo\n</iframe>` today.\n\n## After heading\n\nsecret tail\n',
  // Round-18 SECURITY: remark consumes a LINK REFERENCE DEFINITION entirely and
  // emits no node, so a `</textarea>` in its destination or title is not a real
  // closer — but it survived into the haystack and kept the prose opener live
  // (byte-identical output in both spellings).
  'rawtext-closer-in-link-definition-title-does-not-unescape':
    'The <textarea> element explained.\n\n[a]: /x "</textarea>"\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-link-definition-destination-does-not-unescape':
    'The <textarea> element explained.\n\n[a]: </textarea>\n\n## After heading\n\nsecret tail\n',
  // ---------------------------------------------------------------------------
  // Round-19 SECURITY. Five findings, all authored here rather than left to the
  // sweep — the sweep is what MISSED them (see `markerLineListWrap`).
  // ---------------------------------------------------------------------------
  // (i) The NINTH instance: `blankListItemCode`'s `top >= 4` gate, justified by
  //     a table entry claiming "below column 4 the top-level passes already cover
  //     the line at the right column". True of a CONTINUATION line (absolute
  //     indent 2-3 is inside `FENCE_RE`'s cap) and FALSE of the MARKER line,
  //     which is examined only at column 0 where the leading `- ` / `1. ` is not
  //     whitespace. So at the two MOST COMMON marker spellings the marker line
  //     got no run at all. The fence is EOF-TERMINATED on purpose: the closed
  //     spelling is rescued only INCIDENTALLY by `findInlineCodeRanges` matching
  //     the two backtick runs, so the live hole is the unclosed one — the state
  //     every fence passes through mid-stream.
  'rawtext-closer-in-narrow-marker-line-fence-does-not-unescape':
    'The <textarea> element explained.\n\n- ```html\n  </textarea>\n',
  'rawtext-closer-in-narrow-ordered-marker-line-fence-does-not-unescape':
    'The <textarea> element explained.\n\n1. ```html\n   </textarea>\n',
  'rawtext-iframe-closer-in-narrow-marker-line-fence-does-not-unescape':
    'The <iframe> element explained.\n\n- ```html\n  </iframe>\n',
  // (ii) The TENTH instance: `LIST_MARKER_RE` matches only the FIRST marker on a
  //      line, so an INNER item's content column was never pushed and the fix
  //      above does not reach these. `blankListItemCode` now recurses into
  //      ITSELF on the stripped run. The link-definition spelling also falsifies
  //      the table's "absorbs … ONE list marker" claim.
  'rawtext-closer-in-nested-marker-line-fence-does-not-unescape':
    'The <textarea> element explained.\n\n- - ```html\n    </textarea>\n',
  'rawtext-closer-in-nested-marker-line-link-definition-does-not-unescape':
    'The <textarea> element explained.\n\n- - [a]: /x "</textarea>"\n',
  // (iii) A whole UNCOVERED SHELTER CLASS: the INLINE link/image destination and
  //       title. remark consumes them into href/title exactly as it consumes a
  //       reference definition's, so the closer is fake — but only the
  //       DEFINITION spelling had a pass. All eight spellings reproduced live.
  'rawtext-closer-in-inline-link-title-does-not-unescape':
    'The <textarea> element explained.\n\n[a](/x "</textarea>")\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-inline-link-single-quoted-title-does-not-unescape':
    "The <textarea> element explained.\n\n[a](/x '</textarea>')\n\n## After heading\n\nsecret tail\n",
  'rawtext-closer-in-inline-link-paren-title-does-not-unescape':
    'The <textarea> element explained.\n\n[a](/x (</textarea>))\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-inline-image-title-does-not-unescape':
    'The <textarea> element explained.\n\n![a](/x "</textarea>")\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-inline-link-angle-destination-does-not-unescape':
    'The <textarea> element explained.\n\n[a](</textarea>)\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-quoted-inline-link-title-does-not-unescape':
    'The <textarea> element explained.\n\n> [a](/x "</textarea>")\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-listed-inline-link-title-does-not-unescape':
    'The <textarea> element explained.\n\n- [a](/x "</textarea>")\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-mid-paragraph-inline-link-title-does-not-unescape':
    'The <textarea> element explained.\n\nSee [a](/x "</textarea>") for more.\n\n## After heading\n\nsecret tail\n',
  'rawtext-iframe-closer-in-inline-link-title-does-not-unescape':
    'The <iframe> element explained.\n\n[a](/x "</iframe>")\n\n## After heading\n\nsecret tail\n',
  // (iv) `blankLinkDefinitions` missed the MULTI-LINE definition spelling —
  //      CommonMark allows destination and/or title on FOLLOWING lines, and the
  //      continuation state only accepted a BARE QUOTED TITLE. The `[a]:` line
  //      blanked; the `destination + title` line stayed fully visible.
  'rawtext-closer-in-multiline-link-definition-does-not-unescape':
    'The <textarea> element explained.\n\n[a]:\n/x "</textarea>"\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-multiline-link-definition-destination-does-not-unescape':
    'The <textarea> element explained.\n\n[a]:\n</textarea>\n\n## After heading\n\nsecret tail\n',
  // (v) ROUND 20 — the BRACKET half of the very class (iii) opened. Round 19
  //     wrote the generalization ("every region CommonMark turns into an
  //     ATTRIBUTE rather than document text is a shelter of the same kind") and
  //     then implemented it for the `(…)` payload only, on a rationale that is
  //     true of an INLINE LINK's `[…]` and false of every other bracket
  //     spelling: an image's alt is a string ATTRIBUTE, and a reference or
  //     footnote label is an IDENTIFIER remark never renders. All seven
  //     reproduced live in BOTH renderers (`escapeUnknownHtmlTags` byte-
  //     identical, a live `<textarea>` swallowing the rest of the paragraph).
  'rawtext-closer-in-inline-image-alt-does-not-unescape':
    'The <textarea> element explained.\n\n![</textarea>](/x)\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-reference-image-alt-does-not-unescape':
    'The <textarea> element explained.\n\n![</textarea>][r]\n\n[r]: /x\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-reference-label-does-not-unescape':
    'The <textarea> element explained.\n\n[a][</textarea>]\n\n[</textarea>]: /x\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-collapsed-reference-label-does-not-unescape':
    'The <textarea> element explained.\n\n[</textarea>][]\n\n[</textarea>]: /x\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-footnote-label-does-not-unescape':
    'The <textarea> element explained.\n\nSee[^</textarea>]\n\n[^</textarea>]: note\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-quoted-image-alt-does-not-unescape':
    'The <textarea> element explained.\n\n> ![</textarea>](/x)\n\n## After heading\n\nsecret tail\n',
  'rawtext-closer-in-listed-image-alt-does-not-unescape':
    'The <textarea> element explained.\n\n- ![</textarea>](/x)\n\n## After heading\n\nsecret tail\n',
  'rawtext-iframe-closer-in-inline-image-alt-does-not-unescape':
    'The <iframe> element explained.\n\n![</iframe>](/x)\n\n## After heading\n\nsecret tail\n',
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
  // Round-12 SECURITY (the round-9 hole, reopened through INLINE CODE): round 11
  // scoped the balance guard to the FENCE alternative on the reasoning that an
  // inline span "can shelter nothing, because remark emits it as an `inlineCode`
  // TEXT node". That invariant is exactly what fails INSIDE AN HTML BLOCK, where
  // remark emits raw HTML and backticks are not code at all — so `` `<textarea>` ``
  // on its own line inside `<div>` / `<pre>` / `<details>` was pushed VERBATIM
  // and swallowed the rest of the message (reproduced end-to-end: textarea 1,
  // `h2` undefined). The guard is now gated on HTML-BLOCK MEMBERSHIP rather than
  // on the span's flavor, which covers both spellings with one property.
  'rawtext-opener-in-inline-code-in-html-block-div-not-sheltered':
    'intro\n\n<div>\n`<textarea>`\n</div>\n\n## After heading\n\nsecret tail\n',
  'rawtext-opener-in-inline-code-in-html-block-pre-not-sheltered':
    'intro\n\n<pre>\n`<textarea>`\n</pre>\n\n## After heading\n\nsecret tail\n',
  'rawtext-opener-in-inline-code-in-html-block-details-not-sheltered':
    'intro\n\n<details>\n`<textarea>`\n</details>\n\n## After heading\n\nsecret tail\n',
  // …and the type-7 start condition (a complete tag ALONE on a line, tag name
  // outside the type-1/type-6 lists) is the same hole with a different opener.
  'rawtext-opener-in-inline-code-in-html-block-span-not-sheltered':
    'intro\n\n<span>\n`<textarea>`\n</span>\n\n## After heading\n\nsecret tail\n',
  // Round-15 SECURITY: the SAME shelter, reopened by ONE INVISIBLE CHARACTER.
  // `computeHtmlBlockRanges` decided "blank line" (which ends a type-6/7 block)
  // with `String.trim()`, and JS `trim()` strips the whole Unicode White_Space
  // set — U+00A0 NBSP, U+000B VT, U+000C FF, U+FEFF BOM — while CommonMark's
  // blank line is spaces and tabs ONLY. So a filler line holding just an NBSP
  // terminated the TRACKED range while remark kept the block open: the
  // inline-code shelter below it was no longer "inside a tracked block", the
  // balance guard went blind, and `escapeUnknownHtmlTags` returned the input
  // BYTE-IDENTICAL with a LIVE `<textarea>` in the DOM swallowing the tail.
  // Fixed by `isBlankLine` (utils/markdown-fences). The whitespace-spelling
  // DIMENSION is swept over the whole corpus below (`EXOTIC_BLANK_WRAPPERS`).
  'rawtext-opener-in-nbsp-filler-html-block-not-sheltered':
    '<div>\n \n`<textarea>`\n\nrest of the answer\n\n## After heading\n\nsecret tail\n',
  'rawtext-iframe-in-nbsp-filler-html-block-not-sheltered':
    '<div>\n \n`<iframe>`\n\nrest of the answer\n',
  // Round-13 SECURITY (the same hole, third spelling): `computeHtmlBlockRanges`
  // matched every start/end condition against the RAW line, anchored `^ {0,3}<`.
  // Inside a CONTAINER (blockquote / list item) the line begins with the
  // container marker, so NO start condition ever fired — yet CommonMark opens
  // the type-6 block INSIDE the container and every following line is HTML
  // content. `spanInsideHtmlBlock` therefore returned false, the balance guard
  // did not fire, and `` `<textarea>` `` was pushed through VERBATIM:
  // `escapeUnknownHtmlTags` returned the input BYTE-IDENTICAL and the heading +
  // tail below became the editable value of a live textarea. Reproduced across
  // the whole cross-product (`>` depth 1 and 2, `-` and `1.` items, div /
  // details shelters, textarea / title / iframe openers). The walk now strips
  // the container prefix before matching.
  'rawtext-opener-in-inline-code-in-blockquoted-html-block-not-sheltered':
    '> intro\n>\n> <div>\n> `<textarea>`\n> </div>\n>\n> ## After heading\n>\n> secret tail\n',
  'rawtext-opener-in-inline-code-in-nested-blockquoted-html-block-not-sheltered':
    '> > intro\n> >\n> > <details>\n> > `<textarea>`\n> > </details>\n> >\n> > ## After heading\n> >\n> > secret tail\n',
  'rawtext-opener-in-inline-code-in-list-item-html-block-not-sheltered':
    '- intro\n\n  <div>\n  `<textarea>`\n  </div>\n\n  ## After heading\n\n  secret tail\n',
  'rawtext-opener-in-inline-code-in-ordered-item-html-block-not-sheltered':
    '1. intro\n\n   <div>\n   `<textarea>`\n   </div>\n\n   ## After heading\n\n   secret tail\n',
  // …and the same shape with an `<iframe>` opener, which puts a LIVE iframe in
  // the DOM rather than merely swallowing the tail.
  'rawtext-iframe-in-inline-code-in-blockquoted-html-block-not-sheltered':
    '> intro\n>\n> <div>\n> `<iframe>`\n> </div>\n>\n> ## After heading\n>\n> secret tail\n',
  // Round-14 SECURITY (the same hole, FOURTH spelling — TAB COLUMNS). The
  // container walk measured the list content column in CHARACTERS, but
  // CommonMark measures COLUMNS and a tab advances to the next multiple of 4.
  // `-\t-\t` is 4 characters and 8 columns, so a continuation line indented 8
  // spaces was stripped by only 4 and still looked indented by 4 — every
  // `^ {0,3}<\u2026` start condition missed, no range was recorded,
  // `spanInsideHtmlBlock` returned false, the balance guard never fired, and the
  // protected span was pushed through VERBATIM (`escapeUnknownHtmlTags`
  // returned the input BYTE-IDENTICAL). Reproduced in BOTH renderers at 2 and 3
  // markers, with the `<textarea>` spelling SWALLOWING the tail and the
  // `<iframe>` spelling putting a LIVE `<iframe src=\u2026>` in the DOM.
  'rawtext-opener-in-inline-code-in-tab-list-item-html-block-not-sheltered':
    '-\t-\tintro\n        <div>\n        `<textarea>`\n        more\n\n## After heading\n\nsecret tail\n',
  'rawtext-opener-in-inline-code-in-deep-tab-list-item-html-block-not-sheltered':
    '-\t-\t-\tintro\n            <div>\n            `<textarea>`\n            more\n\n## After heading\n\nsecret tail\n',
  'rawtext-iframe-in-inline-code-in-tab-list-item-html-block-not-sheltered':
    '-\t-\tintro\n        <div>\n        `<iframe>`\n        more\n\n## After heading\n\nsecret tail\n',
  // Round-14 SECURITY (FIFTH spelling — a FOREIGN container's filler line).
  // A type-6/7 block ends at the first blank line, and inside a container the
  // container's own filler IS that blank line. The termination test used the
  // FULLY-stripped line, and the strip consumes ANY container markers rather
  // than the ones that were open \u2014 so a line holding a DIFFERENT container's
  // opener (`  >` inside a `- <div>` item, `> -` inside a `> <div>` quote)
  // normalized to empty, read as blank, and ENDED the range early, re-opening
  // the shelter. Under CommonMark that line is HTML content and the block
  // continues. The control without the filler line renders 0, so the filler
  // line is the entire difference.
  'rawtext-opener-after-foreign-filler-in-list-item-html-block-not-sheltered':
    '- <div>\n  >\n  `<textarea>`\n\n## After heading\n\nsecret tail\n',
  'rawtext-opener-after-foreign-filler-in-blockquoted-html-block-not-sheltered':
    '> <div>\n> -\n> `<textarea>`\n\n## After heading\n\nsecret tail\n',
  // Round-12 REGRESSION (found independently by both reviewers): the round-11
  // cap-overflow fallback `escapeLeftoverTagStarts` escaped ANY `<tag` start in
  // a gap, including gaps the MASK already knows are code — and entity refs are
  // not decoded inside code, so the reader saw the literal `&lt;`. Ordinary
  // pseudo-code in an indented block is the common shape.
  'indented-code-angle-bracket-not-escaped': 'Para\n\n    if a <b then\n    done\n',
  // Round-12 LATENT COUPLING (safe today, pinned so it stays that way): none of
  // these are matched by `TAG_LIKE_REGEX` or `LEFTOVER_TAG_START_RE`, and none
  // needs to be — CommonMark's open-tag production requires `/` to be
  // IMMEDIATELY followed by `>`, so remark never emits an `html` node for them
  // and parse5 never sees a start tag. That safety rests on remark's tag grammar
  // continuing to agree with the sanitizer's, which is what this fixture pins.
  'rawtext-slash-not-immediately-before-gt-is-inert':
    'Hello\n\n<textarea/ >\n\n<textarea/foo>\n\n<textarea//>\n\n## After heading\n\n- item\n',
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
    'rawtext-closer-in-quoted-list-indented-fence-does-not-unescape',
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

  // Round-12: the SAME hole, sheltered by INLINE CODE instead of a fence. Round
  // 11 scoped the balance guard to fences because an inline span "cannot shelter
  // anything" — true in ordinary prose, false inside an HTML block, where remark
  // emits raw HTML and the backticks are not code. The guard is now gated on
  // HTML-BLOCK MEMBERSHIP, which is the property BOTH spellings share.
  it.each([
    'rawtext-opener-in-inline-code-in-html-block-div-not-sheltered',
    'rawtext-opener-in-inline-code-in-html-block-pre-not-sheltered',
    'rawtext-opener-in-inline-code-in-html-block-details-not-sheltered',
    'rawtext-opener-in-inline-code-in-html-block-span-not-sheltered',
  ])('does not shelter an opener in INLINE CODE inside an HTML block: %s', async (name) => {
    const container = await renderStable(<SimpleMarkdownRenderer content={SHARED_FIXTURES[name]} />)
    expect(container.querySelectorAll('textarea').length, name).toBe(0)
    expect(container.querySelector('h2')?.textContent, name).toBe('After heading')
    expect(container.textContent, name).toContain('secret tail')
  })

  // Round-12: `/` not IMMEDIATELY followed by `>` is not a valid open tag under
  // CommonMark, so remark emits no `html` node and neither sanitizer regex needs
  // to match. Pinned because that safety is a coupling, not a local property.
  it('is inert for a slash not immediately before the closing bracket', async () => {
    const container = await renderStable(
      <SimpleMarkdownRenderer
        content={SHARED_FIXTURES['rawtext-slash-not-immediately-before-gt-is-inert']}
      />,
    )
    expect(container.querySelectorAll('textarea').length).toBe(0)
    expect(container.querySelector('h2')?.textContent).toBe('After heading')
    expect(container.querySelectorAll('li').length).toBe(1)
  })

  // Round-12 REGRESSION: the cap-overflow fallback must not escape inside code.
  // Entity refs are not decoded there, so the reader sees a literal `&lt;`.
  it('does not escape a bare `<` inside an indented code block', async () => {
    const md = SHARED_FIXTURES['indented-code-angle-bracket-not-escaped']
    expect(escapeUnknownHtmlTags(md)).toBe(md)
    const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(container.querySelector('code')?.textContent).toBe('if a <b then\ndone\n')
  })

  // …including an over-long tag, which is what the fallback was written for: in
  // a region the MASK calls code it is a code sample, not a live opener. (Kept
  // out of SHARED_FIXTURES to spare the snapshots ~15KB of filler.)
  it.each([
    ['indented', 'Para\n\n    <div ' + 'b'.repeat(5000) + '>\n'],
    ['fenced', 'Para\n\n```\n<div ' + 'b'.repeat(5000) + '>\n```\n'],
    ['inline', 'Hi `<div ' + 'b'.repeat(3000) + '>` there'],
  ])('leaves an over-long tag inside code unescaped: %s', (_name, md) => {
    expect(escapeUnknownHtmlTags(md)).not.toContain('&lt;div')
  })

  // …while the SAME shape in PROSE still fails closed (the round-11 fix).
  it('still escapes an over-long tag written in prose', () => {
    const md = 'Hello\n\n<iframe src="' + 'b'.repeat(5000) + '">\n\n## After heading\n'
    expect(escapeUnknownHtmlTags(md)).toContain('&lt;iframe')
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

  // Round-13: an HTML block opened INSIDE a container (blockquote / list item).
  // `computeHtmlBlockRanges` matched `^ {0,3}<…` against the RAW line, so the
  // container marker made every start condition miss and the balance guard went
  // blind — `escapeUnknownHtmlTags` returned these inputs BYTE-IDENTICAL.
  it.each([
    ['rawtext-opener-in-inline-code-in-blockquoted-html-block-not-sheltered', 'textarea'],
    ['rawtext-opener-in-inline-code-in-nested-blockquoted-html-block-not-sheltered', 'textarea'],
    ['rawtext-opener-in-inline-code-in-list-item-html-block-not-sheltered', 'textarea'],
    ['rawtext-opener-in-inline-code-in-ordered-item-html-block-not-sheltered', 'textarea'],
    ['rawtext-iframe-in-inline-code-in-blockquoted-html-block-not-sheltered', 'iframe'],
  ])('does not shelter an opener inside a CONTAINER-nested HTML block: %s', async (name, tag) => {
    const md = SHARED_FIXTURES[name]
    // The sanitizer must actually act on it (the round-13 symptom was a no-op).
    expect(escapeUnknownHtmlTags(md), name).not.toBe(md)
    const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(container.querySelectorAll(tag).length, name).toBe(0)
    expect(container.querySelector('h2')?.textContent, name).toBe('After heading')
    expect(container.textContent, name).toContain('secret tail')
  })

  // Round-14: the container walk measured the list content column in CHARACTERS
  // where CommonMark measures COLUMNS, so a TAB-spelled list prefix
  // under-consumed the continuation indent and every start condition missed.
  // `escapeUnknownHtmlTags` was a total no-op on these and the DOM carried a
  // live RAWTEXT element. Asserted in BOTH renderers: the hole was in the
  // shared sanitizer, so a Simple-only test would have pinned half of it.
  it.each([
    ['rawtext-opener-in-inline-code-in-tab-list-item-html-block-not-sheltered', 'textarea'],
    ['rawtext-opener-in-inline-code-in-deep-tab-list-item-html-block-not-sheltered', 'textarea'],
    ['rawtext-iframe-in-inline-code-in-tab-list-item-html-block-not-sheltered', 'iframe'],
    // …and the FOREIGN-FILLER shape: a line that a greedy container strip reads
    // as blank (so the block terminated early) but CommonMark reads as HTML
    // content. Termination is now scoped to the OPENING line's prefix width.
    ['rawtext-opener-after-foreign-filler-in-list-item-html-block-not-sheltered', 'textarea'],
    ['rawtext-opener-after-foreign-filler-in-blockquoted-html-block-not-sheltered', 'textarea'],
  ])('does not shelter an opener behind a column-miscounted container: %s', async (name, tag) => {
    const md = SHARED_FIXTURES[name]
    // The sanitizer must actually act on it (the symptom was a byte-identical no-op).
    expect(escapeUnknownHtmlTags(md), name).not.toBe(md)
    for (const [label, Renderer] of [
      ['simple', SimpleMarkdownRenderer],
      ['rich', RichMarkdownRenderer],
    ] as const) {
      const container = await renderStable(<Renderer content={md} />)
      expect(container.querySelectorAll(tag).length, `${name} / ${label}`).toBe(0)
      expect(container.textContent, `${name} / ${label}`).toContain('secret tail')
    }
  })

  // Round-14 CONTROL: the foreign-filler fixtures must differ from their
  // filler-less twins ONLY by that line — otherwise they would prove nothing.
  it.each([
    ['- <div>\n  `<textarea>`\n\n## After heading\n\nsecret tail\n'],
    ['> <div>\n> `<textarea>`\n\n## After heading\n\nsecret tail\n'],
  ])('the filler-less control was already safe: %#', async (md) => {
    const container = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(container.querySelectorAll('textarea').length).toBe(0)
  })

  // Round-14: a GENUINE filler (the opening container's own) must still
  // TERMINATE the block — the fix scopes termination, it must not disable it.
  it.each([
    ['blockquote', '> <div>\n>\n> after\n'],
    ['nested-blockquote', '> > <div>\n> >\n> > after\n'],
    ['list-item', '- <div>\n\n  after\n'],
  ])('still terminates an HTML block at its OWN container filler: %s', (_n, md) => {
    // The line after the filler is outside the block, so a protected span there
    // is ordinary inline code and is left verbatim.
    const withSpan = md.replace('after', '`<textarea>`')
    expect(escapeUnknownHtmlTags(withSpan)).toBe(withSpan)
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
    'rawtext-closer-in-quoted-list-indented-fence-does-not-unescape',
    'rawtext-closer-in-html-comment-does-not-unescape',
    'rawtext-closer-after-info-string-closer-does-not-unescape',
    'mismatched-fence-carve-does-not-shelter-opener',
    'rawtext-opener-in-html-block-div-not-sheltered',
    'rawtext-opener-in-html-block-pre-not-sheltered',
    'rawtext-opener-in-html-block-details-not-sheltered',
    // …and the same four shapes in the INLINE-CODE shelter spelling (round 12),
    // so the sweep covers BOTH shelter spellings × BOTH tag spellings.
    'rawtext-opener-in-inline-code-in-html-block-div-not-sheltered',
    'rawtext-opener-in-inline-code-in-html-block-pre-not-sheltered',
    'rawtext-opener-in-inline-code-in-html-block-details-not-sheltered',
    'rawtext-opener-in-inline-code-in-html-block-span-not-sheltered',
    // …and the same hole in the CONTAINER-NESTED spelling (round 13).
    'rawtext-opener-in-inline-code-in-blockquoted-html-block-not-sheltered',
    'rawtext-opener-in-inline-code-in-nested-blockquoted-html-block-not-sheltered',
    'rawtext-opener-in-inline-code-in-list-item-html-block-not-sheltered',
    'rawtext-opener-in-inline-code-in-ordered-item-html-block-not-sheltered',
    'rawtext-iframe-in-inline-code-in-blockquoted-html-block-not-sheltered',
    'list-marker-inside-fence-does-not-shift-indent-columns',
    'list-marker-inside-fence-html-block-combo',
    'wide-list-marker-gap-clamps-content-column',
    // …and the round-15 blank-line-semantics shelter.
    'rawtext-opener-in-nbsp-filler-html-block-not-sheltered',
    'rawtext-iframe-in-nbsp-filler-html-block-not-sheltered',
    // …and the round-18 shapes: a block opened ON the list-marker line, a code
    // span crossing a line break, and a link reference definition.
    'rawtext-closer-in-marker-line-fence-does-not-unescape',
    'rawtext-closer-in-marker-line-ordered-fence-does-not-unescape',
    'rawtext-closer-in-marker-line-tab-fence-does-not-unescape',
    'rawtext-closer-in-quoted-marker-line-fence-does-not-unescape',
    'rawtext-iframe-closer-in-marker-line-fence-does-not-unescape',
    'rawtext-closer-in-continuation-line-fence-does-not-unescape',
    'rawtext-closer-in-multiline-code-span-does-not-unescape',
    'rawtext-iframe-closer-in-multiline-code-span-does-not-unescape',
    'rawtext-closer-in-link-definition-title-does-not-unescape',
    'rawtext-closer-in-link-definition-destination-does-not-unescape',
    // …and the round-19 shapes: NARROW and NESTED list-marker lines, the whole
    // INLINE link/image payload shelter class, and multi-line definitions.
    'rawtext-closer-in-narrow-marker-line-fence-does-not-unescape',
    'rawtext-closer-in-narrow-ordered-marker-line-fence-does-not-unescape',
    'rawtext-iframe-closer-in-narrow-marker-line-fence-does-not-unescape',
    'rawtext-closer-in-nested-marker-line-fence-does-not-unescape',
    'rawtext-closer-in-nested-marker-line-link-definition-does-not-unescape',
    'rawtext-closer-in-inline-link-title-does-not-unescape',
    'rawtext-closer-in-inline-link-single-quoted-title-does-not-unescape',
    'rawtext-closer-in-inline-link-paren-title-does-not-unescape',
    'rawtext-closer-in-inline-image-title-does-not-unescape',
    'rawtext-closer-in-inline-link-angle-destination-does-not-unescape',
    'rawtext-closer-in-quoted-inline-link-title-does-not-unescape',
    'rawtext-closer-in-listed-inline-link-title-does-not-unescape',
    'rawtext-closer-in-mid-paragraph-inline-link-title-does-not-unescape',
    'rawtext-iframe-closer-in-inline-link-title-does-not-unescape',
    'rawtext-closer-in-multiline-link-definition-does-not-unescape',
    'rawtext-closer-in-multiline-link-definition-destination-does-not-unescape',
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

  // Round-12: the sweep's invariant used to be purely DIFFERENTIAL (`selfEl`
  // counts === `bareEl` counts), so a common-mode regression that broke BOTH
  // spellings passed it — two entries were pinned by snapshot alone. Every
  // corpus entry is a "the prose opener must escape" shape, so the ABSOLUTE
  // truth is zero live RAWTEXT elements, with one deliberate exception: the
  // Turkish-`İ` fixture opens with a PROPERLY CLOSED `<textarea>a</textarea>`
  // before its bare opener, and that one must keep rendering.
  const LIVE_RAWTEXT_EXPECTED: Record<string, number> = {
    'rawtext-mask-survives-turkish-dotted-i': 1,
  }

  // -------------------------------------------------------------------------
  // Round-15: LINE ENDINGS as a first-class corpus DIMENSION.
  // -------------------------------------------------------------------------
  // The corpus is authored LF-only, so every `$`-anchored line regex in the
  // pipeline was swept in exactly one spelling. `FENCE_RE` ended `(.*)$` — `.`
  // excludes `\r` and `$` (no `m` flag) anchors at end of INPUT — so on a CRLF
  // document the shared fence tracker matched NOTHING and was completely
  // fence-blind: `rawtext-closer-in-fence-does-not-unescape`, respelled CRLF,
  // left a LIVE `<textarea>` while its LF twin escaped correctly. CRLF composes
  // with every wrapper below for free, so it is applied LAST (after the
  // container wrap and the tag-spelling rewrite).
  const LINE_ENDINGS = {
    lf: (md: string) => md,
    crlf: (md: string) => md.replace(/\n/g, '\r\n'),
  } as const
  const LINE_ENDING_NAMES = Object.keys(LINE_ENDINGS) as (keyof typeof LINE_ENDINGS)[]

  const SELF_CLOSING_CASES: [string, keyof typeof LINE_ENDINGS][] = []
  for (const name of SWALLOW_CORPUS)
    for (const eol of LINE_ENDING_NAMES) SELF_CLOSING_CASES.push([name, eol])

  it.each(SELF_CLOSING_CASES)(
    'swallow corpus holds in the self-closing spelling: %s / %s',
    async (name, eol) => {
    const eolize = LINE_ENDINGS[eol]
    const bare = eolize(SHARED_FIXTURES[name])
    const md = eolize(selfClose(SHARED_FIXTURES[name]))
    expect(md, name).not.toBe(bare) // the rewrite actually applied
    const bareEl = await renderStable(<SimpleMarkdownRenderer content={bare} />)
    const selfEl = await renderStable(<SimpleMarkdownRenderer content={md} />)
    // ABSOLUTE: no swallow in EITHER spelling, independent of the comparison.
    const expected = LIVE_RAWTEXT_EXPECTED[name] ?? 0
    for (const [label, el] of [
      ['bare', bareEl],
      ['self-closing', selfEl],
    ] as const) {
      expect(el.querySelectorAll(RAWTEXT_SELECTORS.join(',')).length, `${name} ${label}`).toBe(
        expected,
      )
    }
    // Spelling-independence: parse5 treats `<tag/>` as a start tag, so the two
    // spellings must yield the same live RAWTEXT elements…
    expect(rawtextCounts(selfEl), name).toBe(rawtextCounts(bareEl))
    // …and the same document structure below the opener (no swallow).
    expect(selfEl.querySelectorAll('h1,h2,h3,li,p').length, name).toBe(
      bareEl.querySelectorAll('h1,h2,h3,li,p').length,
    )
    },
  )

  // -------------------------------------------------------------------------
  // Round-13: CONTAINER NESTING as a first-class corpus DIMENSION.
  // -------------------------------------------------------------------------
  // The 294-case round-12 matrix missed the container hole entirely because
  // EVERY case was authored at column 0. Container nesting is now swept exactly
  // like the bare-vs-`<tag/>` spelling dimension: each corpus entry is also
  // rendered inside a blockquote (depth 1 and 2) and inside a bullet / ordered
  // list item, in BOTH tag spellings, and must satisfy the SAME absolute
  // invariant (zero live RAWTEXT elements, per-entry `LIVE_RAWTEXT_EXPECTED`)
  // plus the spelling-differential one. Any future shelter shape is therefore
  // caught in every container spelling automatically.
  const perLine = (f: (line: string) => string) => (md: string) =>
    md.split('\n').map(f).join('\n')

  /** Tabs to 4-column stops \u2014 mirrors the sanitizer's `expandTabs`, so a
   *  TAB-spelled marker's continuation pad lands on the real content column. */
  const expandTabs = (str: string) => {
    let out = ''
    for (const ch of str) out += ch === '\t' ? ' '.repeat(4 - (out.length % 4)) : ch
    return out
  }

  /** A list item: the marker on the first line, the content column on the rest. */
  const listWrap = (marker: string) => (md: string) => {
    const pad = ' '.repeat(expandTabs(marker).length)
    let seen = false
    return md
      .split('\n')
      .map((l) => {
        if (l === '') return ''
        if (!seen) {
          seen = true
          return marker + l
        }
        return pad + l
      })
      .join('\n')
  }

  /**
   * ROUND-18 — THE MARKER-LINE VARIANT, the dimension 1032 container cases
   * missed. `listWrap` puts the marker on the FIRST non-blank line, and every
   * corpus fixture BEGINS WITH PROSE, so every container case placed its block
   * on a CONTINUATION line — the one position `blankListItemCode` handled. A
   * block opened ON the marker line itself was never swept, and that is exactly
   * where the eighth instance of the fail-open class lived.
   *
   * This wrapper leaves the fixture's leading prose at top level (so the prose
   * RAWTEXT opener still sits outside the item) and starts the list item at the
   * line that OPENS A BLOCK. Everything below is padded to the content column
   * exactly as in `listWrap`, so the item's shape is otherwise identical.
   *
   * ROUND-19 — THE WRAPPER WAS GREEN FOR THE WRONG REASON, WHICH IS WHY 2855
   * TESTS MISSED THREE LIVE INSTANCES. It used to mark the first non-blank line
   * AFTER the first prose line. In every `SWALLOW_CORPUS` fixture that line is
   * MORE PROSE or a `## heading`, never the fence — so the construct always
   * landed on a padded CONTINUATION line at absolute indent 2-3, INSIDE
   * `FENCE_RE`'s 0..3 cap, i.e. the one position that was already covered. The
   * narrow-marker wrappers (`- ` / `1. `) were added specifically to sweep the
   * marker-line position independently of the column and STRUCTURALLY COULD NOT
   * land a block construct there. It now targets the first line that actually
   * opens a block — a code fence or a link reference definition — falling back
   * to the old rule for fixtures whose shelter is not a block construct (inline
   * code spans, attribute strings, HTML blocks), which keeps their coverage
   * unchanged. `wrapper marks a block-opening line` below pins the targeting.
   */
  /** A line that OPENS A BLOCK: a code fence or a link reference definition. */
  const BLOCK_OPENER_RE = /^[ \t]{0,3}(?:```|~~~|\[[^\]\n]{0,99}\]:)/
  /** Index of the line `markerLineListWrap` puts the marker on, or -1. */
  const markerLineTarget = (lines: string[]) => {
    const opener = lines.findIndex((l, i) => i > 0 && l !== '' && BLOCK_OPENER_RE.test(l))
    if (opener > 0) return opener
    const first = lines.findIndex((l) => l !== '')
    return first === -1 ? -1 : lines.findIndex((l, i) => i > first && l !== '')
  }
  const markerLineListWrap = (marker: string) => (md: string) => {
    const pad = ' '.repeat(expandTabs(marker).length)
    const lines = md.split('\n')
    const target = markerLineTarget(lines)
    if (target <= 0) return md
    return lines
      .map((l, i) => (l === '' ? '' : i < target ? l : i === target ? marker + l : pad + l))
      .join('\n')
  }

  /** A list item whose BLANK separators carry a FOREIGN container's opener at
   *  the content column. Those lines look blank to a greedy container strip but
   *  are HTML content under CommonMark \u2014 the round-14 early-termination shape. */
  const foreignFillerListWrap = (marker: string, filler: string) => (md: string) => {
    const pad = ' '.repeat(expandTabs(marker).length)
    let seen = false
    return md
      .split('\n')
      .map((l) => {
        if (l === '') return pad + filler
        if (!seen) {
          seen = true
          return marker + l
        }
        return pad + l
      })
      .join('\n')
  }

  /**
   * `preservesColumns` says whether the wrapper keeps each line's indentation
   * RELATIVE to its container's content column. Only the SPACE blockquotes do:
   * `> ` is exactly the two columns the block-quote parser consumes, so the
   * remainder is byte-for-byte the original line. Every list wrapper shifts by
   * its content column, and the TAB blockquote (`>\t`) consumes `>` plus ONE
   * column of the tab and leaves the other two as indentation \u2014 both re-parse a
   * shape whose MEANING is a column into something else (see
   * `COLUMN_SENSITIVE_ENTRIES`). The round-13 sweep decided this with a
   * `wrapper.startsWith('blockquote')` string test, which would have silently
   * (and wrongly) admitted `blockquote-tab`.
   *
   * ROUND-17: CONTAINER NESTING IS NOW SWEPT TO DEPTH 2+. Every wrapper above is
   * a SINGLE container, so the round-13 axis only ever swept one level deep:
   * every quoted case put its fence at quote-relative column 0, and every
   * list-nested case was at top level. The PRODUCT of two containers was never
   * tested — and that product is exactly where the seventh instance of the
   * fail-open class lived (a fenced sample in a list item INSIDE a blockquote
   * was masked by NO pass, because `blankQuotedCode` did not call
   * `blankListItemCode` while `blankListItemCode` did call `blankQuotedCode`).
   * The `nest()` compositions below add that dimension: quote⊗list,
   * quote⊗quote⊗list and list⊗quote, each in the three content-column spellings
   * (`1.  ` / `-   ` / `-\t`) that clear the 3-column `FENCE_RE` indent cap.
   * They compose with the tag-spelling, line-ending and exotic-blank dimensions
   * for free, exactly like the single-container wrappers.
   */
  /** Compose two wrappers: `nest(outer, inner)` puts `inner` INSIDE `outer`.
   *  Columns survive only when BOTH layers preserve them — one list layer
   *  anywhere in the stack shifts every line by its content column. */
  const nest = (
    outer: { wrap: (md: string) => string; preservesColumns: boolean },
    inner: { wrap: (md: string) => string; preservesColumns: boolean },
  ) => ({
    wrap: (md: string) => outer.wrap(inner.wrap(md)),
    preservesColumns: outer.preservesColumns && inner.preservesColumns,
  })
  const BQ1 = {
    wrap: perLine((l: string) => (l === '' ? '>' : `> ${l}`)),
    preservesColumns: true,
  }
  const BQ2 = {
    wrap: perLine((l: string) => (l === '' ? '> >' : `> > ${l}`)),
    preservesColumns: true,
  }
  /** List markers whose CONTENT COLUMN is 4 — past `FENCE_RE`'s absolute
   *  3-column indent cap, which is what makes the nested fence invisible. */
  const WIDE_LIST_MARKERS = { ordered: '1.  ', bullet: '-   ', tab: '-\t' } as const
  const CONTAINER_WRAPPERS = {
    'blockquote-depth-1': {
      wrap: perLine((l: string) => (l === '' ? '>' : `> ${l}`)),
      preservesColumns: true,
    },
    'blockquote-depth-2': {
      wrap: perLine((l: string) => (l === '' ? '> >' : `> > ${l}`)),
      preservesColumns: true,
    },
    'bullet-item': { wrap: listWrap('- '), preservesColumns: false },
    'ordered-item': { wrap: listWrap('1. '), preservesColumns: false },
    // Round-14: the WHITESPACE SPELLING is its own dimension. Every wrapper
    // above is space-built, so the sweep covered exactly one spelling and a
    // tab-spelled container prefix \u2014 whose content column is a tab STOP, not a
    // character count \u2014 was invisible to it.
    'bullet-item-tab': { wrap: listWrap('-\t'), preservesColumns: false },
    'blockquote-tab': {
      wrap: perLine((l: string) => (l === '' ? '>' : `>\t${l}`)),
      preservesColumns: false,
    },
    // Round-14: a filler line that a greedy strip reads as blank but CommonMark
    // reads as HTML content, which used to TERMINATE the block early.
    'bullet-item-foreign-filler': {
      wrap: foreignFillerListWrap('- ', '>'),
      preservesColumns: false,
    },
    'blockquote-foreign-filler': {
      wrap: perLine((l: string) => (l === '' ? '> -' : `> ${l}`)),
      preservesColumns: false,
    },
    // Round-15: the EXOTIC-WHITESPACE spelling of a blank line is its own
    // dimension. Every separator in the corpus is a truly empty line, so the
    // sweep only ever exercised one spelling of "blank" — and the pipeline
    // decided blankness with `String.trim()`, which strips U+00A0 / U+000B /
    // U+000C / U+FEFF while CommonMark's blank line is spaces and tabs only.
    // A filler line holding one of those is CONTENT to remark and BLANK to the
    // tracked-range walk, which is exactly how the HTML-block shelter reopened
    // (see `rawtext-opener-in-nbsp-filler-html-block-not-sheltered`). These
    // wrappers preserve every non-blank line verbatim, so column-sensitive
    // entries are safe to sweep in them.
    ...(Object.fromEntries(
      (
        [
          ['nbsp', '\u00a0'],
          ['vertical-tab', '\u000b'],
          ['form-feed', '\u000c'],
          ['bom', '\ufeff'],
        ] as const
      ).map(([label, ch]) => [
        `exotic-blank-${label}`,
        { wrap: perLine((l: string) => (l === '' ? ch : l)), preservesColumns: true },
      ]),
    ) as Record<string, { wrap: (md: string) => string; preservesColumns: boolean }>),
    // Round-17: CONTAINER × CONTAINER. `quote-x-*` is a wide list item inside a
    // blockquote (the reported hole), `nested-quote-x-*` the same at quote depth
    // 2, and `list-x-quote` the MIRROR direction (a blockquote inside a list
    // item) so neither leg of the mutual recursion is swept alone.
    ...(Object.fromEntries(
      Object.entries(WIDE_LIST_MARKERS).flatMap(([label, marker]) => {
        const item = { wrap: listWrap(marker), preservesColumns: false }
        return [
          [`quote-x-${label}-item`, nest(BQ1, item)],
          [`nested-quote-x-${label}-item`, nest(BQ2, item)],
          [`${label}-item-x-quote`, nest(item, BQ1)],
        ]
      }),
    ) as Record<string, { wrap: (md: string) => string; preservesColumns: boolean }>),
    // Round-18: the MARKER-LINE variant of every list-bearing wrapper above —
    // the block opened ON the marker line rather than on a continuation line.
    ...(Object.fromEntries(
      Object.entries(WIDE_LIST_MARKERS).flatMap(([label, marker]) => {
        const item = { wrap: markerLineListWrap(marker), preservesColumns: false }
        return [
          [`marker-line-${label}-item`, item],
          [`quote-x-marker-line-${label}-item`, nest(BQ1, item)],
          [`nested-quote-x-marker-line-${label}-item`, nest(BQ2, item)],
          [`marker-line-${label}-item-x-quote`, nest(item, BQ1)],
        ]
      }),
    ) as Record<string, { wrap: (md: string) => string; preservesColumns: boolean }>),
    // …and the NARROW markers too (content column 2/3, under the `FENCE_RE`
    // cap), so the marker-line position is swept independently of the column.
    'marker-line-bullet-item': { wrap: markerLineListWrap('- '), preservesColumns: false },
    'marker-line-ordered-item': { wrap: markerLineListWrap('1. '), preservesColumns: false },
  } as const

  // Entries whose MEANING is a column: an indented-code block at exactly 4, a
  // fence indented into a list content column, a marker-gap clamp. A list
  // wrapper shifts every line right by the content column, which re-parses those
  // shapes as something else (the indented code stops being at +4 relative to
  // the item, the clamp fixture gets a SECOND marker). They are swept in the
  // blockquote wrappers only — a `> ` prefix is consumed by the block-quote
  // parser and RESETS the content column, so relative indentation is preserved.
  const COLUMN_SENSITIVE_ENTRIES = new Set([
    'rawtext-closer-in-indented-code-does-not-unescape',
    'rawtext-closer-in-tab-indented-code-does-not-unescape',
    'rawtext-closer-in-list-indented-fence-does-not-unescape',
    'rawtext-closer-in-quoted-list-indented-fence-does-not-unescape',
    'list-marker-inside-fence-does-not-shift-indent-columns',
    'list-marker-inside-fence-html-block-combo',
    'wide-list-marker-gap-clamps-content-column',
    // Already authored INSIDE a list item; re-wrapping in another one only
    // re-tests the wrapper.
    'rawtext-opener-in-inline-code-in-list-item-html-block-not-sheltered',
    'rawtext-opener-in-inline-code-in-ordered-item-html-block-not-sheltered',
    // Round-18: the marker-line shapes ARE a list-item column by construction —
    // a list wrapper pads them into a different one and re-parses the fence.
    'rawtext-closer-in-marker-line-fence-does-not-unescape',
    'rawtext-closer-in-marker-line-ordered-fence-does-not-unescape',
    'rawtext-closer-in-marker-line-tab-fence-does-not-unescape',
    'rawtext-closer-in-quoted-marker-line-fence-does-not-unescape',
    'rawtext-iframe-closer-in-marker-line-fence-does-not-unescape',
    'rawtext-closer-in-continuation-line-fence-does-not-unescape',
    // Round-19: same reason — these ARE list-item columns by construction.
    'rawtext-closer-in-narrow-marker-line-fence-does-not-unescape',
    'rawtext-closer-in-narrow-ordered-marker-line-fence-does-not-unescape',
    'rawtext-iframe-closer-in-narrow-marker-line-fence-does-not-unescape',
    'rawtext-closer-in-nested-marker-line-fence-does-not-unescape',
    'rawtext-closer-in-nested-marker-line-link-definition-does-not-unescape',
    'rawtext-closer-in-listed-inline-link-title-does-not-unescape',
  ])

  const CONTAINER_CASES: [string, string, keyof typeof LINE_ENDINGS][] = []
  for (const name of SWALLOW_CORPUS)
    for (const [wrapper, spec] of Object.entries(CONTAINER_WRAPPERS))
      if (!COLUMN_SENSITIVE_ENTRIES.has(name) || spec.preservesColumns)
        // …and every (entry × wrapper) pair in BOTH line-ending spellings, so
        // the CRLF dimension composes with the container one for free.
        for (const eol of LINE_ENDING_NAMES) CONTAINER_CASES.push([name, wrapper, eol])

  it.each(CONTAINER_CASES)(
    'swallow corpus holds inside a container: %s / %s / %s',
    async (name, wrapper, eol) => {
      const { wrap } = CONTAINER_WRAPPERS[wrapper as keyof typeof CONTAINER_WRAPPERS]
      const eolize = LINE_ENDINGS[eol]
      const bare = eolize(wrap(SHARED_FIXTURES[name]))
      const md = eolize(selfClose(wrap(SHARED_FIXTURES[name])))
      const bareEl = await renderStable(<SimpleMarkdownRenderer content={bare} />)
      const selfEl = await renderStable(<SimpleMarkdownRenderer content={md} />)
      const expected = LIVE_RAWTEXT_EXPECTED[name] ?? 0
      for (const [label, el] of [
        ['bare', bareEl],
        ['self-closing', selfEl],
      ] as const) {
        expect(
          el.querySelectorAll(RAWTEXT_SELECTORS.join(',')).length,
          `${name} / ${wrapper} / ${eol} / ${label}`,
        ).toBe(expected)
      }
      expect(rawtextCounts(selfEl), `${name} / ${wrapper} / ${eol}`).toBe(rawtextCounts(bareEl))
      expect(
        selfEl.querySelectorAll('h1,h2,h3,li,p').length,
        `${name} / ${wrapper} / ${eol}`,
      ).toBe(bareEl.querySelectorAll('h1,h2,h3,li,p').length)
    },
  )

  // Round-19 META-TEST: `markerLineListWrap` must actually put the marker on a
  // line that OPENS A BLOCK. Its predecessor could not, and that is the whole
  // reason the narrow-marker wrappers passed while three live instances sat
  // uncovered. Every corpus entry carrying a fence or a link definition is
  // checked; a wrapper that regresses to "first non-blank after the prose"
  // fails here rather than passing silently for the wrong reason.
  it('markerLineListWrap marks a block-opening line', () => {
    const blockBearing = SWALLOW_CORPUS.filter((name) =>
      SHARED_FIXTURES[name]
        .split('\n')
        .some((l, i) => i > 0 && l !== '' && BLOCK_OPENER_RE.test(l)),
    )
    // The corpus must actually contain such entries, or the assertion is vacuous.
    expect(blockBearing.length).toBeGreaterThan(10)
    for (const name of blockBearing)
      for (const marker of ['- ', '1. ', '-   ', '1.  ', '-\t']) {
        const wrapped = markerLineListWrap(marker)(SHARED_FIXTURES[name])
        const markerLine = wrapped.split('\n').find((l) => l.startsWith(marker))
        expect(markerLine, `${name} / ${JSON.stringify(marker)}`).toBeDefined()
        // The marker is IMMEDIATELY followed by the block opener — the construct
        // is ON the marker line, not on a padded continuation line below it.
        expect(
          BLOCK_OPENER_RE.test(markerLine!.slice(marker.length)),
          `${name} / ${JSON.stringify(marker)} / ${JSON.stringify(markerLine)}`,
        ).toBe(true)
      }
  })

  // Round-19: CONTAINER NESTING DEPTH. The round-17 termination note claimed
  // `> -   ` alternation at 8000 levels ran with "no throw, ≤4 ms"; it did not —
  // HEAD raises `RangeError: Maximum call stack size exceeded` from ~2000 levels
  // up, i.e. a 24 KB message crashes the renderer. The recursion is finite but
  // its DEPTH is bounded only by input length. `CONTAINER_NEST_LIMIT` blanks an
  // over-deep run WHOLE (fail-closed) instead of recursing, so the mask stays
  // total, length-preserving and closer-free at every depth.
  it.each([
    ['alternation', (d: number) => '> -   '.repeat(d) + '```html\n' + '> -   '.repeat(d) + '</textarea>\n'],
    // The closer is padded to the INNERMOST item's content column, so it really
    // is fence content. (Padded to a SHALLOWER column it would close the inner
    // items and be a genuine top-level closer, which must stay visible.)
    ['list-markers', (d: number) => '- '.repeat(d) + '```html\n' + ' '.repeat(2 * d) + '</textarea>\n'],
  ])('masks arbitrarily deep container nesting without throwing: %s', (_label, mk) => {
    for (const depth of [1, 63, 64, 65, 2000, 8000, 40000]) {
      const doc = mk(depth)
      const masked = __buildCloserHaystackForTest(doc)
      expect(masked.length, `depth ${depth}`).toBe(doc.length)
      // Fail-CLOSED: the sheltered closer is gone from the haystack.
      expect(masked.includes('</textarea>'), `depth ${depth}`).toBe(false)
    }
  })

  // Round-19 ESCALATION: the inline-title shelter with an ATTRIBUTE-BEARING
  // opener. Not privilege escalation (`iframe`/`src` are allowlisted) but
  // exactly the content-swallow this module prevents — a live iframe retaining
  // both attributes, with the document below it consumed.
  it('does not shelter an attribute-bearing opener behind an inline link title', async () => {
    const md =
      'Embedding <iframe src="https://evil.example/x" width="600"> explained.\n\n' +
      '[a](/x "</iframe>")\n\n## After heading\n\nsecret tail\n'
    expect(escapeUnknownHtmlTags(md)).not.toBe(md)
    const el = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(el.querySelectorAll('iframe').length).toBe(0)
    expect(el.textContent).toContain('secret tail')
  })

  // -------------------------------------------------------------------------
  // Round-20: the BRACKET half of the attribute-shelter class.
  // -------------------------------------------------------------------------
  // ESCALATION, the same shape round 19 pinned for the payload: an
  // attribute-bearing opener behind an IMAGE ALT shelter kept `src`, `width` and
  // `height` on a LIVE iframe, with the paragraph below it consumed.
  it('does not shelter an attribute-bearing opener behind an image alt', async () => {
    const md =
      'Embed: <iframe src="https://evil.example/x" width="600" height="400">\n\n' +
      '![</iframe>](/x)\n\n## After heading\n\nsecret tail\n'
    expect(escapeUnknownHtmlTags(md)).not.toBe(md)
    const el = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(el.querySelectorAll('iframe').length).toBe(0)
    expect(el.textContent).toContain('secret tail')
  })

  // The COMPLEMENT of the same rule, and the reason the pass may not simply
  // blank every `[…]`: remark EMITS an inline link's text and a bare SHORTCUT
  // reference's text as HTML, so a closer written there is REAL and the opener
  // above it is correctly left live. Blanking these would only over-escape, but
  // the boundary is the whole point of the pass — pin it.
  it.each([
    ['inline link text', 'The <textarea> element.\n\n[<textarea>hi</textarea>](/x)\n'],
    ['shortcut reference', 'The <textarea> element.\n\n[</textarea>]\n\n[</textarea>]: /x\n'],
  ])('leaves REMARK-EMITTED bracket text visible: %s', (_label, md) => {
    expect(escapeUnknownHtmlTags(md)).toBe(md)
  })

  // -------------------------------------------------------------------------
  // Round-20: the length caps must BLANK, not SKIP.
  // -------------------------------------------------------------------------
  // `INLINE_LINK_PAYLOAD_MAX` and the link-definition regexes' `{0,999}` bounds
  // each spent an over-limit exit as "not a link, leave visible" — the same
  // fail-OPEN shape `ba4a526b` closed for over-cap inline code spans, in code
  // written after that fix. CommonMark bounds neither a destination nor a title,
  // so these are ordinary documents. Every row was a byte-identical no-op with a
  // live RAWTEXT element before the fix; the 900-char controls below already
  // escaped correctly, which is what makes the cap (not the shape) the cause.
  const capFiller = 'y'.repeat(1100)
  const okFiller = 'y'.repeat(900)
  it.each([
    ['inline title', `[a](/x "${capFiller}</textarea>")`],
    ['inline destination', `[a](/${capFiller}</textarea>)`],
    ['inline angle destination', `[a](</${capFiller}</textarea>>)`],
    ['definition title', `[a]: /x "${capFiller}</textarea>"`],
    ['definition destination', `[a]: /${capFiller}</textarea>`],
    ['definition label', `[${capFiller}]: /x "</textarea>"`],
  ])('an OVER-CAP shelter still blanks: %s', async (_label, shelter) => {
    const md =
      'The <textarea> element explained.\n\n' +
      shelter +
      '\n\n## After heading\n\nsecret tail\n'
    expect(escapeUnknownHtmlTags(md)).toContain('&lt;textarea&gt;')
    const el = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(el.querySelectorAll('textarea').length).toBe(0)
    expect(el.textContent).toContain('secret tail')
  })

  it.each([
    ['inline title', `[a](/x "${okFiller}</textarea>")`],
    ['definition title', `[a]: /x "${okFiller}</textarea>"`],
  ])('…and the UNDER-cap control behaves identically: %s', (_label, shelter) => {
    const md =
      'The <textarea> element explained.\n\n' +
      shelter +
      '\n\n## After heading\n\nsecret tail\n'
    expect(escapeUnknownHtmlTags(md)).toContain('&lt;textarea&gt;')
  })

  // The over-cap escalation, with attributes.
  it('does not shelter an attribute-bearing opener behind an over-cap title', async () => {
    const md =
      'Embed: <iframe src="https://evil.example/x" width="600">\n\n' +
      `[a](/x "${capFiller}</iframe>")\n\n## After heading\n\nsecret tail\n`
    expect(escapeUnknownHtmlTags(md)).not.toBe(md)
    const el = await renderStable(<SimpleMarkdownRenderer content={md} />)
    expect(el.querySelectorAll('iframe').length).toBe(0)
  })

  // …and a stray `](` still blanks NOTHING: the cap decides when to stop
  // parsing, never how little to blank, so an unparseable shape declines and
  // ordinary prose containing `](` is untouched.
  it('a stray `](` in prose blanks nothing', () => {
    const md = 'The <textarea> element.\n\nsee foo](bar baz and then </textarea> later\n'
    const masked = __buildCloserHaystackForTest(md)
    expect(masked.length).toBe(md.length)
    expect(masked).toContain('</textarea>')
  })

  // Round-19 (LOW, cosmetic): `blankLinkDefinitions`' label pattern also matched
  // a GFM FOOTNOTE definition, whose content is BLOCK-parsed and may hold REAL
  // html. The pair below rendered as escaped visible source while the
  // byte-identical pair in plain prose rendered correctly. Fail-closed, so not a
  // security defect — but the two must now agree.
  it('does not blank a GFM footnote definition', async () => {
    const md = 'Body[^a].\n\n[^a]: <textarea>hi</textarea>\n'
    expect(escapeUnknownHtmlTags(md)).toBe(md)
    const el = await renderStable(<SimpleMarkdownRenderer content={md} />)
    const plain = await renderStable(
      <SimpleMarkdownRenderer content={'Body.\n\nSee <textarea>hi</textarea>\n'} />,
    )
    expect(el.querySelectorAll('textarea').length).toBe(
      plain.querySelectorAll('textarea').length,
    )
    expect(el.textContent).not.toContain('<textarea>')
  })

  // …while a real link reference definition next to it is STILL blanked — the
  // footnote carve-out must not reopen the round-18 shelter.
  it('still blanks a link definition sharing the document with a footnote', () => {
    const md =
      'The <textarea> element[^a] explained.\n\n[^a]: note\n\n[a]: /x "</textarea>"\n\n' +
      '## After heading\n\nsecret tail\n'
    expect(escapeUnknownHtmlTags(md)).toContain('&lt;textarea&gt;')
  })

  // -------------------------------------------------------------------------
  // Round-16: INLINE-SPAN LENGTH as a first-class corpus DIMENSION.
  // -------------------------------------------------------------------------
  // Every inline-code shelter in the corpus above is a SHORT span, so the whole
  // six-dimension matrix only ever exercised spans the mask's 4096-char regex
  // cap could match. Above the cap the span matched NEITHER the mask regex nor
  // the carve regex, the mask left the sheltered `</textarea>` VISIBLE in the
  // closer haystack, `hasLaterCloser` returned true, the prose opener stayed
  // LIVE and parse5 swallowed the rest of the message as the textarea's value.
  // A clean cliff with padding as the only variable — span content ≤4094 chars:
  // 0 live textareas; ≥4099: 1. The mask no longer uses a capped regex
  // (`findInlineCodeRanges`), and this axis pins the dimension: every shelter
  // spelling is now swept at cap−k AND cap+k.
  const INLINE_SPAN_PADS = { 'under-cap': 4080, 'over-cap': 4085 } as const

  /** Shelter spellings, parameterized by RAWTEXT tag and inline-span padding. */
  const SPAN_LENGTH_SHAPES: Record<string, (tag: string, pad: number) => string> = {
    // The reported hole: the CLOSER hides inside an over-long span, so the
    // prose opener above it must still be escaped.
    'closer-in-inline-code': (tag, pad) =>
      `intro\n\n<${tag}>\n\n\`${'x'.repeat(pad)} </${tag}> \`\n\n## After heading\n\nsecret tail\n`,
    // …and the mirror shape: the OPENER hides inside an over-long span that
    // sits inside an HTML block, where the span is not really code.
    'opener-in-inline-code-in-html-block-div': (tag, pad) =>
      `intro\n\n<div>\n\`${'x'.repeat(pad)} <${tag}> \`\n</div>\n\n## After heading\n\nsecret tail\n`,
    'opener-in-inline-code-in-html-block-pre': (tag, pad) =>
      `intro\n\n<pre>\n\`${'x'.repeat(pad)} <${tag}> \`\n</pre>\n\n## After heading\n\nsecret tail\n`,
    'opener-in-inline-code-in-html-block-details': (tag, pad) =>
      `intro\n\n<details>\n\`${'x'.repeat(pad)} <${tag}> \`\n</details>\n\n## After heading\n\nsecret tail\n`,
    'opener-in-inline-code-in-blockquoted-html-block': (tag, pad) =>
      `> intro\n>\n> <div>\n> \`${'x'.repeat(pad)} <${tag}> \`\n> </div>\n>\n> ## After heading\n>\n> secret tail\n`,
  }

  const SPAN_LENGTH_CASES: [string, string, keyof typeof INLINE_SPAN_PADS][] = []
  for (const shape of Object.keys(SPAN_LENGTH_SHAPES))
    for (const tag of ['textarea', 'iframe'])
      for (const len of Object.keys(INLINE_SPAN_PADS) as (keyof typeof INLINE_SPAN_PADS)[])
        SPAN_LENGTH_CASES.push([shape, tag, len])

  it.each(SPAN_LENGTH_CASES)(
    'shelter holds at every inline-span length: %s / %s / %s',
    async (shape, tag, len) => {
      const build = SPAN_LENGTH_SHAPES[shape]
      const bare = build(tag, INLINE_SPAN_PADS[len])
      const md = selfClose(bare)
      const label = `${shape} / ${tag} / ${len}`
      for (const [spelling, src] of [
        ['bare', bare],
        ['self-closing', md],
      ] as const) {
        const el = await renderStable(<SimpleMarkdownRenderer content={src} />)
        // Nothing RAWTEXT may be live, in EITHER tag spelling and at EITHER
        // side of the retired cap.
        expect(
          el.querySelectorAll(RAWTEXT_SELECTORS.join(',')).length,
          `${label} / ${spelling}`,
        ).toBe(0)
        // …and the document below the shelter must survive intact: a swallow
        // leaves the tail alive only as a textarea VALUE, invisible to the
        // element count above.
        expect(el.textContent, `${label} / ${spelling}`).toContain('secret tail')
      }
    },
  )

  // Round-16: the mask's inline-code pass stopped being a regex, so the claim
  // "same match semantics, minus the cap and the backtracking" needs a proof.
  // Differential fuzz against the retired regex in its UNCAPPED spelling over a
  // backtick-dense alphabet — the shapes that exercise every branch (opener run
  // giving back backticks, a closer inside the SAME run, a resume landing
  // MID-RUN, and no-closer-at-all).
  //
  // ROUND-18 — THE ORACLE'S UNIT CHANGED FROM A LINE TO A PARAGRAPH SEGMENT.
  // A CommonMark code span crosses line breaks, so the retired per-line regex
  // was not merely slow, it was WRONG in the fail-OPEN direction (`` `foo\n
  // </textarea>` `` left the closer visible in the haystack — see
  // `findInlineCodeRanges`). The oracle therefore changes shape with the scan:
  // the SAME regex — greedy opener run, lazy body, backreference closer — with
  // its body class widened from `[^\n]` to `[\s\S]`, applied INDEPENDENTLY to
  // each maximal run of non-blank lines and offset back into the document.
  //
  // WHY IT IS STILL A VALID ORACLE: it is derived from the specification, not
  // from the implementation. CommonMark's code-span rule is exactly "matching
  // backtick strings within one paragraph", so the regex expresses the closer
  // semantics and the segmentation expresses the paragraph bound; the two are
  // written here with completely different machinery (regex backtracking +
  // `split`) from the scan's suffix-max index walk. `isBlankLine` is shared on
  // purpose — the definition of a paragraph break is one fact, not two — and it
  // is itself pinned by the exotic-blank dimension of the sweep. The alphabet
  // already contains `\n` and ' ', so blank lines, one-line segments and
  // multi-line segments are all generated.
  it('the inline-code scan matches the retired regex, per paragraph segment', () => {
    const TICK = String.fromCharCode(96)
    const RE = new RegExp('(' + TICK + '+)[\\s\\S]*?\\1', 'g')
    const alphabet = [TICK, TICK, TICK, 'a', 'b', '\n', ' ', '<', '>']
    let seed = 12345
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    /** Maximal runs of non-blank lines, as `[start, end)` offsets. */
    const segments = (src: string): [number, number][] => {
      const out: [number, number][] = []
      let offset = 0
      let start = -1
      let end = -1
      for (const line of src.split('\n')) {
        if (isBlankLine(line)) {
          if (start !== -1) out.push([start, end])
          start = -1
        } else {
          if (start === -1) start = offset
          end = offset + line.length
        }
        offset += line.length + 1
      }
      if (start !== -1) out.push([start, end])
      return out
    }
    for (let iter = 0; iter < 20000; iter++) {
      let src = ''
      const n = 1 + Math.floor(rnd() * 24)
      for (let i = 0; i < n; i++) src += alphabet[Math.floor(rnd() * alphabet.length)]
      const want: [number, number][] = []
      for (const [from, to] of segments(src)) {
        const seg = src.slice(from, to)
        RE.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = RE.exec(seg)) !== null)
          want.push([from + m.index, from + m.index + m[0].length])
      }
      expect(__findInlineCodeRangesForTest(src), JSON.stringify(src)).toEqual(want)
    }
  })

  // -------------------------------------------------------------------------
  // Round-16: the sweep also drives `splitStreamingBlocks`.
  // -------------------------------------------------------------------------
  // Every arm above renders through `SimpleMarkdownRenderer`, so NEITHER the
  // exotic-blank NOR the CRLF dimension ever touched the streaming splitter —
  // which is exactly how four hand-rolled `line.trim() === ''` tests survived
  // in `streaming.ts` after `isBlankLine` was minted as THE blank-line SSOT.
  // `trim()` strips U+00A0 / U+000B / U+000C / U+FEFF, none of which CommonMark
  // calls blank, so one such line cut a paragraph into two `ReactMarkdown`
  // units on the streaming path (two `<p>` where the non-streaming and SEO
  // twins render one). The control is the SAME document with the exotic filler
  // replaced by an ordinary non-blank character: both are non-blank under
  // CommonMark, so both must split identically.
  it('the splitter is swept across the corpus x containers x line endings', () => {
    const EXOTIC_FILLERS: Record<string, string> = {
      'exotic-blank-nbsp': '\u00a0',
      'exotic-blank-vertical-tab': '\u000b',
      'exotic-blank-form-feed': '\u000c',
      'exotic-blank-bom': '\ufeff',
    }
    let checked = 0
    let controls = 0
    for (const name of SWALLOW_CORPUS) {
      for (const [wrapper, spec] of Object.entries(CONTAINER_WRAPPERS)) {
        if (COLUMN_SENSITIVE_ENTRIES.has(name) && !spec.preservesColumns) continue
        const wrapped = spec.wrap(SHARED_FIXTURES[name])
        const lfBlocks = splitStreamingBlocks(wrapped)
        for (const eol of LINE_ENDING_NAMES) {
          const md = LINE_ENDINGS[eol](wrapped)
          const blocks = splitStreamingBlocks(md)
          const label = `${name} / ${wrapper} / ${eol}`
          // LOSSLESS: the units are a partition of the source, so the engine's
          // per-unit parses cover the document exactly once.
          expect(blocks.map((b) => b.text).join('\n'), label).toBe(md)
          // …and `startLine` stays a running line count over that partition.
          let line = 1
          for (const b of blocks) {
            expect(b.startLine, `${label} #${b.index}`).toBe(line)
            line += b.text.split('\n').length
          }
          // The line ending is not a block boundary: CRLF must split exactly
          // like its LF twin.
          expect(blocks.length, label).toBe(lfBlocks.length)
          checked++
        }
        // EXOTIC BLANKS ARE NOT BLANK. Compare against the non-blank control.
        const filler = EXOTIC_FILLERS[wrapper]
        if (filler !== undefined) {
          const control = SHARED_FIXTURES[name]
            .split('\n')
            .map((l) => (l === '' ? 'x' : l))
            .join('\n')
          expect(
            splitStreamingBlocks(wrapped).length,
            `${name} / ${wrapper} vs non-blank control`,
          ).toBe(splitStreamingBlocks(control).length)
          controls++
        }
      }
    }
    // Pinned, not "greater than": the splitter arm must stay in lockstep with
    // the renderer arm's (entry x wrapper x line-ending) matrix above.
    expect(checked).toBe(CONTAINER_CASES.length)
    expect(controls).toBe(SWALLOW_CORPUS.length * 4)
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

  // --- round-15 REGRESSION vs `main`: CRLF documents ------------------------
  // `main`'s extractor pattern was `^(#{1,N})\\s+(.+)` — no end anchor at all,
  // so the trailing `\\r` of a CRLF line landed in the title and was trimmed off
  // afterwards. The unified `ATX_HEADING_RE` ends `[ \\t]*$`, which `\\r` does not
  // satisfy, so a CRLF document produced ZERO sections and ZERO heading anchors
  // where `main` produced them: every CRLF-stored doc / blog / release body
  // silently lost its TOC, its in-page anchors and its doc-SEO heading links.
  // (Direct A/B over this fixture: `main` → ["Real","Second"], branch → [].)
  const CRLF_HEADINGS_MD =
    '# Real\r\n\r\nbody\r\n\r\n## Second\r\n\r\n```\r\n# In fence\r\n```\r\n'

  it('CRLF documents scan the same headings as their LF twin', () => {
    const lf = CRLF_HEADINGS_MD.replace(/\r/g, '')
    expect(scanHeadings(CRLF_HEADINGS_MD)).toEqual(scanHeadings(lf))
    expect(extractSections(CRLF_HEADINGS_MD, { maxLevel: 2 }).map((sec) => sec.title)).toEqual([
      'Real',
      'Second',
    ])
    // …and the `# In fence` line is still fence content in BOTH spellings —
    // the fence tracker used to match no CRLF line at all.
    expect(extractSections(CRLF_HEADINGS_MD, { maxLevel: 2 })).toEqual(
      extractSections(lf, { maxLevel: 2 }),
    )
  })

  it('CRLF renderer heading ids equal extractSections ids', async () => {
    const sections = extractSections(CRLF_HEADINGS_MD, { maxLevel: 2 })
    const container = await renderStable(<SimpleMarkdownRenderer content={CRLF_HEADINGS_MD} />)
    const renderedIds = Array.from(container.querySelectorAll('h1, h2')).map((el) => el.id)
    expect(renderedIds).toEqual(sections.map((sec) => sec.id))
    expect(renderedIds).toEqual(['real', 'second'])
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
