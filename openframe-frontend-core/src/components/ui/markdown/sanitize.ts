/**
 * Sanitization SSOT for the unified markdown engine.
 *
 * Layered defense (order matters, see engine.tsx):
 *   1. `escapeUnknownHtmlTags` — TEXT pre-pass. Escapes `<tag>`s outside the
 *      effective allowlist so LLM-emitted pseudo-tags (`<their>`, `<ticket>`)
 *      never reach React as unknown elements (React 19 crash guard).
 *      NOT a security boundary.
 *   2. `rehype-raw` parses remaining raw HTML into HAST.
 *   3. `rehypeSanitize` with `buildSanitizeSchema(...)` — the audited
 *      allow-list boundary (hast-util-sanitize) with a schema extended to
 *      exactly what our surfaces need.
 *   4. `rehypeStripUnsafe` — custom strip pass kept as defense-in-depth
 *      (srcset candidate scanning, iframe[srcdoc], belt-and-suspenders if
 *      the schema is ever loosened).
 *
 * COUPLED-ALLOWLIST INVARIANT (tested in __tests__/sanitize-invariant.test.ts):
 * the two effective tag lists are EQUAL (case-insensitively), both computed
 * AFTER merging `extraAllowedHtmlTags`. Both directions matter:
 *   - pre-pass ⊆ sanitizer: the pre-pass must never admit a raw tag the
 *     sanitizer then silently drops.
 *   - sanitizer ⊆ pre-pass: the pre-pass must never ESCAPE a tag the
 *     sanitizer would happily keep. This direction was broken before
 *     2026-07: `strike` (and every other `defaultSchema`-only tag) survived
 *     the sanitizer but was escaped to `&lt;strike&gt;` source text by the
 *     pre-pass, so legacy authored markup regressed to visible tag soup.
 * Both lists are now derived from the SINGLE `effectiveTagList()` below —
 * never fork them.
 *
 * ONE documented exception, and it is CONTENT-dependent rather than
 * list-level (so the invariant test still holds as an equality of tag SETS):
 * an UNCLOSED RAWTEXT/RCDATA opener (`<textarea>`, `<iframe>`, `<title>`, …)
 * is escaped by the pre-pass even though the sanitizer allowlists it —
 * because parse5's tokenizer would otherwise swallow the remainder of the
 * document into it before the sanitizer ever runs. See RAWTEXT_TAGS below.
 */
import { defaultSchema } from 'rehype-sanitize'
import { visit } from 'unist-util-visit'
import { defaultUrlTransform } from 'react-markdown'
import { createFenceTracker } from '../../../utils/markdown-fences'

// ---------------------------------------------------------------------------
// Shared tag allowlist (pre-pass baseline)
// ---------------------------------------------------------------------------
/**
 * Tags the TEXT pre-pass forwards as raw HTML. Anything outside this set
 * (plus per-composition `extraAllowedHtmlTags`) gets its angle brackets
 * escaped and renders as plain text.
 *
 * `video` is deliberately NOT in the baseline: chat strips <video>
 * server-side and playback goes through the <Video> SSOT. The rich
 * composition opts back in via `extraAllowedHtmlTags={['video', 'source']}`
 * so authored content (blog publisher video injection) keeps working.
 */
export const SAFE_HTML_TAGS = new Set([
  // Block + inline text
  'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'blockquote',
  'br', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'dd', 'del',
  'details', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'i', 'ins',
  'kbd', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'pre', 'q', 'rp', 'rt',
  'ruby', 's', 'samp', 'section', 'small', 'span', 'strong', 'sub', 'summary',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'u',
  'ul', 'var', 'wbr',
  // Deprecated presentational tags that REAL authored content still carries.
  // They rendered before the unification (neither old renderer had a
  // pre-pass), so escaping them to visible `&lt;center&gt;` source text was a
  // regression. `font` gets its legacy attributes below so the sanitizer
  // doesn't reduce it to a bare no-op tag. (`marquee` stays out — it is
  // animated chrome, not text markup, and no audit hit found it.)
  'center', 'font', 'big',
  // Media ('video' intentionally excluded — see the header comment)
  'img', 'picture', 'source', 'audio', 'iframe', 'track',
  // Forms (rehype-raw allows them; mostly harmless for chat output)
  'button', 'input', 'label', 'select', 'option', 'optgroup', 'textarea', 'form', 'fieldset', 'legend',
])

/**
 * Inline SVG element set, in the CANONICAL case parse5 produces for SVG
 * foreign content (`linearGradient`, `clipPath`, … are camelCase in the
 * HTML parser's SVG adjustment table, so the sanitize schema must match
 * that spelling; the text pre-pass lowercases before lookup).
 *
 * Inline `<svg>` renders in real published posts (hand-authored diagrams
 * and inline icon markup — NOT `<use href>` sprite references, which are
 * deliberately dropped; see SVG_ATTRIBUTES). The Rich renderer had NO pre-pass
 * and NO sanitizer, so it always rendered; without this set the unified
 * engine would escape it to visible source text.
 *
 * SEVERAL OF THESE NAMES ARE ALSO HTML ELEMENTS (`title`, `desc`, `text`,
 * `g`, `line`, `use`, `symbol`, `marker`, `mask`, `pattern`) — admitting
 * them UNCONSTRAINED let a post or a chat message emit a bare `<title>`,
 * which React 19 hoists into `<head>` (browser-tab + SEO title hijack) and
 * whose RAWTEXT content model swallows the rest of the document when
 * unclosed. They are therefore pinned to an `svg` ancestor in
 * `SVG_ONLY_ANCESTORS` below; outside `<svg>` the sanitizer drops them.
 */
export const SVG_TAGS = new Set([
  'svg', 'path', 'circle', 'ellipse', 'g', 'rect', 'line', 'polyline',
  'polygon', 'text', 'tspan', 'defs', 'use', 'symbol', 'title', 'desc',
  'marker', 'mask', 'pattern', 'linearGradient', 'radialGradient', 'stop',
  'clipPath',
])

/**
 * Required-ancestor constraints for the SVG-only tags (hast-util-sanitize
 * `ancestors`: a listed tag survives ONLY inside one of its ancestors).
 *
 * The TEXT pre-pass may still forward these — it is a flat regex over source
 * text, cannot see nesting, and is explicitly NOT a security boundary. The
 * coupled-allowlist invariant still holds because `ancestors` RESTRICTS a
 * tag the schema already lists; it never adds one the pre-pass would escape.
 */
const SVG_ONLY_ANCESTORS: Record<string, string[]> = {
  title: ['svg'],
  desc: ['svg'],
  text: ['svg'],
  tspan: ['svg', 'text'],
  use: ['svg'],
  symbol: ['svg'],
  marker: ['svg'],
  mask: ['svg'],
  pattern: ['svg'],
  g: ['svg'],
  line: ['svg'],
  path: ['svg'],
  circle: ['svg'],
  ellipse: ['svg'],
  rect: ['svg'],
  polyline: ['svg'],
  polygon: ['svg'],
  defs: ['svg'],
  stop: ['svg'],
  linearGradient: ['svg'],
  radialGradient: ['svg'],
  clipPath: ['svg'],
}

/**
 * THE effective tag list for a composition, canonical case — the single
 * source both the pre-pass set and the sanitize schema derive from
 * (coupled-allowlist invariant, both directions).
 *
 * `defaultSchema.tagNames` is unioned in so the pre-pass can never escape a
 * tag hast-util-sanitize would keep (`strike`, `tt`, …).
 */
function effectiveTagList(extraAllowedHtmlTags?: string[]): string[] {
  return [
    ...(defaultSchema.tagNames ?? []),
    ...SAFE_HTML_TAGS,
    ...SVG_TAGS,
    ...(extraAllowedHtmlTags ?? []),
  ]
}

/** Effective pre-pass tag set for a composition (lowercased for lookup). */
export function buildEffectiveTagSet(extraAllowedHtmlTags?: string[]): Set<string> {
  return new Set(effectiveTagList(extraAllowedHtmlTags).map((t) => t.toLowerCase()))
}

// ---------------------------------------------------------------------------
// rehype-sanitize schema (allow-list boundary)
// ---------------------------------------------------------------------------
/**
 * Per-tag attribute allowances layered on top of hast-util-sanitize's
 * defaultSchema. Property names are hast camelCase. Attribute survival
 * matters as much as tag survival — an attribute-stripped `<video>` is a
 * sourceless player (see plan: "video-survives-sanitize fixture").
 */
const EXTRA_ATTRIBUTES: Record<string, Array<string | [string, ...unknown[]]>> = {
  // `style` is allowed on the tags the 2026-07 content-store audit found it
  // on in REAL published posts (div.takeaway, table styling, reddit
  // blockquotes). This matches pre-unification behavior on BOTH surfaces —
  // neither old renderer stripped style — so it is parity, not loosening;
  // the URL-scheme guards in rehypeStripUnsafe still apply to attributes.
  '*': ['className', 'id', 'data*', 'dir', 'title', 'lang'],
  a: ['target', 'rel', 'href'],
  div: ['style'],
  span: ['style'],
  p: ['style'],
  blockquote: ['style', 'cite'],
  td: ['colSpan', 'rowSpan', 'align', 'style'],
  th: ['colSpan', 'rowSpan', 'align', 'scope', 'style'],
  img: ['src', 'srcSet', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding'],
  iframe: ['src', 'width', 'height', 'allow', 'allowFullScreen', 'frameBorder', 'loading', 'referrerPolicy', 'style'],
  video: ['src', 'poster', 'controls', 'width', 'height', 'loop', 'muted', 'autoPlay', 'playsInline', 'preload'],
  source: ['src', 'type', 'media', 'srcSet', 'sizes'],
  audio: ['src', 'controls', 'loop', 'muted', 'preload'],
  track: ['src', 'kind', 'srcLang', 'label', 'default'],
  time: ['dateTime'],
  details: ['open'],
  // Form elements (allow the benign presentational subset).
  //
  // `input` carries EXACTLY the GFM task-list contract and nothing else.
  // Dropping the attribute widening alone was not enough: defaultSchema
  // pins `required.input = { type:'checkbox', disabled:true }`, and
  // `required` force-ADDS those properties regardless of what the author
  // wrote — so `<input type="text" placeholder="email">` still came out as
  // a disabled checkbox. `buildSanitizeSchema` therefore clears
  // `required.input` (remark-gfm emits `type="checkbox" disabled` on task
  // items itself, so the coercion was redundant) and the contract is
  // expressed here instead: type is pinned to the literal `checkbox`, so a
  // text input degrades to a bare `<input>` rather than a fake checkbox.
  input: [['type', 'checkbox'], 'checked', 'disabled'],
  button: ['type', 'disabled', 'name', 'value'],
  // Legacy presentational tag — without its own attributes the sanitizer
  // would keep `<font>` but strip everything that makes it do anything.
  font: ['color', 'size', 'face'],
  select: ['disabled', 'multiple', 'name'],
  option: ['value', 'selected', 'disabled'],
  optgroup: ['label', 'disabled'],
  textarea: ['rows', 'cols', 'placeholder', 'disabled', 'readOnly', 'name'],
  label: ['htmlFor'],
  col: ['span'],
  colgroup: ['span'],
}

/**
 * SVG presentation/geometry attributes, keyed the way hast keys them:
 * property-information normalizes `font-size` → `fontSize`,
 * `stroke-dasharray` → `strokeDasharray`, … BEFORE the sanitizer sees the
 * tree, so ONLY the camelCase spellings are load-bearing. The dashed
 * spellings previously listed alongside them were dead weight (they never
 * matched anything) and are gone; do not re-add them.
 *
 * `style` is allowed here for parity with div/span/p (same 2026-07 audit
 * rationale — authored SVG carries inline `style` and both pre-unification
 * renderers kept it; the URL guards in rehypeStripUnsafe still apply).
 */
const SVG_ATTRIBUTES = [
  'viewBox', 'xmlns', 'd', 'fill', 'stroke', 'cx', 'cy', 'r', 'rx', 'ry',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'opacity',
  'offset', 'width', 'height', 'style',
  // NOTE the exact casing: property-information's SVG map uses
  // `strokeDashArray` / `strokeDashOffset` / `strokeMiterLimit` (capital
  // A/O/L), NOT the react-DOM spellings. A near-miss here fails SILENTLY —
  // the attribute is simply stripped. Verify against
  // node_modules/property-information/lib/svg.js before adding one.
  'strokeWidth', 'strokeDashArray', 'strokeDashOffset', 'strokeMiterLimit',
  'strokeOpacity', 'strokeLinecap', 'strokeLinejoin',
  'fillRule', 'fillOpacity',
  'stopColor', 'stopOpacity',
  'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'fontStretch',
  'textAnchor', 'dominantBaseline', 'alignmentBaseline', 'letterSpacing',
  'dx', 'dy', 'markerEnd', 'markerMid', 'markerStart',
  'gradientUnits', 'gradientTransform', 'patternUnits', 'maskUnits',
  'preserveAspectRatio',
  'clipPath', 'clipRule',
  // `href` / `xlink:href` stay DELIBERATELY DISALLOWED on SVG elements:
  // `<use href>` pulls in an external document fragment and the hast key
  // (`xlinkHref`) is outside rehypeStripUnsafe's URL_ATTRS check, so it
  // would be an unguarded URL sink. Consequence, stated plainly: PASTED
  // ICON SPRITES THAT RELY ON `<use href="#id">` RENDER EMPTY. Hand-drawn
  // inline SVG (the audited real-content case) is unaffected.
]

export interface BuildSanitizeSchemaOptions {
  extraAllowedHtmlTags?: string[]
}

/**
 * The engine's sanitize schema: defaultSchema ∪ SAFE_HTML_TAGS ∪ extras.
 * - `extraAllowedHtmlTags` is unioned into tagNames here AND into the
 *   pre-pass set (buildEffectiveTagSet) — the coupled-allowlist invariant.
 * - `clobberPrefix: ''` + empty `clobber`: authored raw-HTML anchors
 *   (`<h2 id="…">`) keep their ids so `[jump](#anchor)` deep-links work.
 *   (The renderer's own heading ids are injected at the React layer,
 *   post-rehype, and were never affected.)
 * - `card`/`mention` protocols registered for href so chat markers survive
 *   (the urlTransform below is the second gate).
 */
export function buildSanitizeSchema(options: BuildSanitizeSchemaOptions = {}) {
  // Canonical spelling AND lowercase for every tag: parse5 emits SVG
  // foreign-content tags camelCased (`linearGradient`), HTML tags
  // lowercased — admitting both keeps the schema list a superset of the
  // (lowercased) pre-pass set, so the two are equal case-insensitively.
  const tagNames = new Set<string>()
  for (const tag of effectiveTagList(options.extraAllowedHtmlTags)) {
    tagNames.add(tag)
    tagNames.add(tag.toLowerCase())
  }

  const attributes: Record<string, Array<string | [string, ...unknown[]]>> = {
    ...(defaultSchema.attributes as Record<string, Array<string | [string, ...unknown[]]>>),
  }
  for (const [tag, attrs] of Object.entries(EXTRA_ATTRIBUTES)) {
    attributes[tag] = [...(attributes[tag] ?? []), ...attrs]
  }
  for (const tag of SVG_TAGS) {
    attributes[tag] = [...(attributes[tag] ?? []), ...SVG_ATTRIBUTES]
    const lower = tag.toLowerCase()
    if (lower !== tag) attributes[lower] = [...(attributes[lower] ?? []), ...SVG_ATTRIBUTES]
  }

  // SVG-only tags are pinned to an `svg` ancestor (canonical AND lowercase
  // spelling, matching the tagNames treatment above) so a bare `<title>` /
  // `<text>` / `<g>` in prose is DROPPED instead of hijacking the page.
  const ancestors: Record<string, string[]> = {
    ...(defaultSchema.ancestors as Record<string, string[]> | undefined),
  }
  for (const [tag, required] of Object.entries(SVG_ONLY_ANCESTORS)) {
    ancestors[tag] = required
    ancestors[tag.toLowerCase()] = required
  }

  // `required.input` is CLEARED — see the `input` note in EXTRA_ATTRIBUTES.
  // defaultSchema force-adds `type="checkbox" disabled` to every `<input>`,
  // rewriting authored text inputs into fake disabled checkboxes; remark-gfm
  // already emits both properties on real task-list items, so nothing is
  // lost. The attribute allowlist pins `type` to the literal `checkbox`.
  const required: Record<string, Record<string, unknown>> = {
    ...(defaultSchema.required as Record<string, Record<string, unknown>> | undefined),
  }
  delete required.input

  return {
    ...defaultSchema,
    tagNames: [...tagNames],
    attributes,
    ancestors,
    required,
    clobberPrefix: '',
    clobber: [],
    protocols: {
      ...defaultSchema.protocols,
      href: [...(defaultSchema.protocols?.href ?? []), 'card', 'mention'],
    },
  }
}

// ---------------------------------------------------------------------------
// rehypeStripUnsafe — defense-in-depth strip pass (kept verbatim from the
// pre-unification SimpleMarkdownRenderer)
// ---------------------------------------------------------------------------
const EVENT_HANDLER_ATTR_RE = /^on[a-z]+$/i
const JAVASCRIPT_URL_RE = /^[\s\x00-\x1f]*javascript:/i
const DATA_URL_RE = /^[\s\x00-\x1f]*data:/i
const URL_ATTRS = new Set([
  'href',
  'src',
  'srcset',
  'formaction',
  'xlink:href',
  'poster',
  'data',
  'action',
  'background',
])

/**
 * Returns true if any candidate in an `srcset` attribute has a dangerous
 * URL scheme. srcset is a comma-separated candidate list — a single-URL
 * check would miss a malicious second candidate
 * (`"https://safe.png 1x, javascript:alert(1) 2x"`). Over-splitting on
 * commas inside URL paths over-strips, which is the correct error bias.
 */
function srcsetHasUnsafeCandidate(srcset: string): boolean {
  for (const candidate of srcset.split(',')) {
    const url = candidate.trim().split(/\s+/)[0] ?? ''
    if (JAVASCRIPT_URL_RE.test(url) || DATA_URL_RE.test(url)) return true
  }
  return false
}

const STRIP_ELEMENTS = new Set([
  'script',
  'style',
  'noscript',
  'noembed',
  'object',
  'embed',
  'applet',
  'base',
  'meta',
])

export function rehypeStripUnsafe() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    visit(tree, 'element', (node: any, index: number | undefined, parent: any) => {
      const tag = String(node.tagName ?? '').toLowerCase()
      if (STRIP_ELEMENTS.has(tag)) {
        if (parent && typeof index === 'number') {
          parent.children.splice(index, 1)
          // Return the numeric index so the walker resumes at the slot the
          // removed node vacated.
          return index
        }
        // Root-level strip element — neutralize in place.
        node.children = []
        node.tagName = 'span'
        node.properties = {}
        return
      }
      if (!node.properties || typeof node.properties !== 'object') return
      for (const key of Object.keys(node.properties)) {
        if (EVENT_HANDLER_ATTR_RE.test(key)) {
          delete node.properties[key]
          continue
        }
        if (URL_ATTRS.has(key.toLowerCase())) {
          const raw = node.properties[key]
          const v = Array.isArray(raw) ? raw[0] : raw
          if (typeof v === 'string') {
            const unsafe =
              key.toLowerCase() === 'srcset'
                ? srcsetHasUnsafeCandidate(v)
                : JAVASCRIPT_URL_RE.test(v) || DATA_URL_RE.test(v)
            if (unsafe) {
              delete node.properties[key]
              continue
            }
          }
        }
        if (tag === 'iframe' && key.toLowerCase() === 'srcdoc') {
          delete node.properties[key]
        }
      }
    })
  }
}

// ---------------------------------------------------------------------------
// escapeUnknownHtmlTags — TEXT pre-pass (React 19 crash guard)
// ---------------------------------------------------------------------------
// ReDoS-safe shape (CodeQL polynomial-regex hardening): every quantifier is
// hard-bounded (tag name ≤63 chars, attrs ≤4096) so matching is
// constant-time per tag. Anything longer falls through as plain text —
// the safe-degrade behavior for HTML-in-markdown.
const TAG_LIKE_REGEX = /<(\/?)([a-zA-Z][a-zA-Z0-9-]{0,63})((?:\s[^>]{0,4096}?)?)(\/?)>/g

/**
 * Tags whose HTML content model is RAWTEXT / RCDATA / PLAINTEXT: once parse5
 * sees the start tag, EVERYTHING up to the matching end tag (or, if there is
 * none, to end of input) is consumed as that element's text — headings,
 * paragraphs, list items and all.
 *
 * The tokenizer runs BEFORE the sanitizer, so an allowlist entry (or an
 * `ancestors` pin, as `title` got in round 2) cannot undo the damage: by the
 * time the schema is consulted, the rest of the message is already a single
 * text node hanging off the wrong element. Observed with the unclosed forms:
 *   `<textarea>` → the remainder of the message becomes the editable value
 *                  of a live textarea
 *   `<iframe>`   → the remainder is swallowed into an `about:blank` frame
 *   `<title>`    → the remainder de-structures (headings stop being headings)
 * Any chat message or post that merely MENTIONS one of these in prose — an
 * LLM explaining HTML forms will — mangles everything after it.
 *
 * The TEXT pre-pass is the layer built for exactly this: it runs before
 * parse5 and is purely textual. An opening tag from this set is escaped
 * unless its matching `</tag>` appears LATER in the source, in which case the
 * RAWTEXT span is bounded and the element renders normally (see the
 * `closed-*` fixtures). This check is deliberately independent of the
 * allowlist — it constrains tags the sanitizer WOULD keep.
 */
const RAWTEXT_TAGS = new Set([
  'title', 'textarea', 'iframe', 'xmp', 'noembed', 'noframes', 'plaintext',
])

/**
 * Fenced code blocks and inline code spans — the regions whose `<tags>` are
 * literal content and must survive the escaping pass verbatim.
 *
 * Drives the escaping CARVE in `escapeUnknownHtmlTags`. It is deliberately
 * NARROWER than what the MASK now understands: the mask is the security
 * boundary (too-narrow ⇒ a live `<textarea>` swallows the document) while the
 * carve is cosmetic (too-narrow ⇒ a code sample renders as escaped text), so
 * they are allowed to differ — but only in that direction. See the CARVE
 * DECISION note on `buildCloserHaystack`.
 *
 * Deliberately NARROWER than `createFenceTracker`'s CommonMark notion: this is
 * a flat regex over source TEXT with no line-state, so it only recognizes a
 * fence that is CLOSED by a same-marker run. That is the correct bias here —
 * an unclosed fence leaves its body UNPROTECTED, so a `<textarea>` inside it
 * gets escaped (visible as escaped text) rather than left live. Using the real
 * tracker would mean re-deriving character offsets from line state for a pass
 * that is explicitly not a security boundary; the narrow form fails safe.
 * `~{3,}` and the CommonMark 0..3-space indent ARE handled (they were not
 * before: a `~~~` block containing `<textarea>` rendered as escaped text).
 *
 * The MASK does NOT use this regex's fence alternative at all any more — see
 * `buildCloserHaystack`, which derives its code regions from the real
 * `createFenceTracker` (plus indented / blockquoted / commented code). Only the
 * INLINE-CODE alternative is shared, via `INLINE_CODE_RE` below.
 */
const PROTECTED_SPAN_RE =
  /^ {0,3}(`{3,}|~{3,})[\s\S]*?^ {0,3}\1[^\n]*$|(`+)[^\n]{0,4096}?\2/gm

/**
 * The INLINE-CODE half of `PROTECTED_SPAN_RE`, on its own — the mask's only
 * regex-derived code region. Everything block-level (fences, indented code,
 * blockquoted code, HTML comments) is derived from line state instead, because
 * a flat regex cannot express CommonMark's closer rules: `PROTECTED_SPAN_RE`
 * ends a fenced span at the FIRST same-marker run even when that run carries an
 * info string (```` ```html ````), which CommonMark forbids on a closer — so the
 * span ended early and the real code content was left unmasked.
 */
const INLINE_CODE_RE = /(`+)[^\n]{0,4096}?\1/g

/**
 * ASCII-ONLY case fold. `String.prototype.toLowerCase()` is NOT
 * length-preserving: U+0130 (Turkish dotted capital `İ`) expands to `i` +
 * U+0307 (1 code unit → 2). It is the only BMP character that does so, and it
 * is ordinary Turkish prose (`İstanbul`, `İzmir`) — so a message with enough
 * of them ahead of a `<textarea>` shifted the whole haystack later than the
 * `segmentOffset + index + match.length` the caller computes from the ORIGINAL
 * text, `hasLaterCloser` began scanning in a window strictly BEFORE the
 * opener, matched an already-consumed `</textarea>`, and left the opener LIVE
 * — reopening the RAWTEXT swallow the mask exists to close.
 *
 * Tag names are ASCII by definition (`TAG_LIKE_REGEX` only matches
 * `[a-zA-Z][a-zA-Z0-9-]*`), so folding ASCII alone loses nothing.
 * `buildCloserHaystack(src).length === src.length` is asserted over the whole
 * fixture corpus in the parity test — that invariant is the actual guard.
 */
function foldAsciiCase(text: string): string {
  return text.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32))
}

/**
 * ---------------------------------------------------------------------------
 * MASK-ONLY code-region blanking (never the carve)
 * ---------------------------------------------------------------------------
 * All four passes below share one contract:
 *
 *  - they SCAN `source` (the folded but otherwise unmasked copy) and APPLY the
 *    resulting ranges to `masked`. That split is LOAD-BEARING: `INLINE_CODE_RE`
 *    chews a pair of backticks off an unclosed ```` ``` ```` opener (`` `+ ``
 *    backtracks to a single backtick and matches the next one as its closer),
 *    so a fence scan over the masked copy silently sees no fence at all. Both
 *    strings have identical indices, so offsets transfer verbatim.
 *  - they are LENGTH-PRESERVING (every non-newline char in a range becomes a
 *    space), because `escapeOutsideFences` indexes the mask with offsets it
 *    computed from the ORIGINAL text.
 *  - they fail CLOSED. Blanking too much can only make `hasLaterCloser` return
 *    false, i.e. ESCAPE a RAWTEXT opener that could have stayed live; blanking
 *    too little leaves a prose `<textarea>` live and lets parse5 swallow the
 *    rest of the message. Every approximation here therefore rounds towards
 *    blanking.
 */

/** Length-preserving blank of `[from, to)`. */
function blankRange(masked: string, from: number, to: number): string {
  return (
    masked.slice(0, from) + masked.slice(from, to).replace(/[^\n]/g, ' ') + masked.slice(to)
  )
}

/** One scannable line: where it starts, and (for container-nested scans) where
 *  its scanned content starts once the container prefix is stripped. */
interface MaskLine {
  start: number
  contentStart: number
  content: string
}

function toMaskLines(source: string): MaskLine[] {
  const out: MaskLine[] = []
  let offset = 0
  for (const line of source.split('\n')) {
    out.push({ start: offset, contentStart: offset, content: line })
    offset += line.length + 1
  }
  return out
}

/**
 * Blank every FENCED region in a line run, using the real CommonMark fence
 * state machine (`createFenceTracker`) rather than a regex.
 *
 * This replaces the old `blankUnclosedFence` + `PROTECTED_SPAN_RE` fence
 * alternative and subsumes both:
 *  - a CLOSED fence is blanked from its opener line through its closer line;
 *  - an EOF-terminated fence is blanked from its opener line to the end of the
 *    run (the case `blankUnclosedFence` covered);
 *  - a would-be closer carrying an INFO STRING (```` ```html ````) no longer
 *    ends the region, because the tracker applies CommonMark's rule that a
 *    closer may not have one. `PROTECTED_SPAN_RE` did end the span there, so
 *    ` ```js … ```html\n</textarea>\n``` ` left the `</textarea>` unmasked and
 *    a prose opener above it stayed live.
 */
function blankFencedRegions(masked: string, lines: MaskLine[]): string {
  const fences = createFenceTracker()
  let openStart: number | null = null
  let lastEnd = 0
  for (const line of lines) {
    const role = fences.push(line.content)
    lastEnd = line.contentStart + line.content.length
    if (role === 'open') openStart = line.start
    else if (role === 'close' && openStart !== null) {
      masked = blankRange(masked, openStart, lastEnd)
      openStart = null
    }
  }
  if (openStart !== null) masked = blankRange(masked, openStart, lastEnd)
  return masked
}

/**
 * Blank INDENTED code blocks (4+ spaces or a tab). A `</textarea>` written as
 * an indented code sample is code, not a closer — but `FENCE_RE` deliberately
 * caps fence indent at 3 spaces, so the tracker never sees these lines.
 *
 * Deliberately unconditional: a 4-space-indented paragraph CONTINUATION line is
 * not really code, and gets blanked anyway. That is the fail-closed direction.
 * Lines inside a fence are already blanked by `blankFencedRegions`.
 */
const INDENTED_CODE_LINE_RE = /^(?: {4,}|\t)/

function blankIndentedCode(masked: string, lines: MaskLine[]): string {
  for (const line of lines) {
    if (INDENTED_CODE_LINE_RE.test(line.content))
      masked = blankRange(masked, line.contentStart, line.contentStart + line.content.length)
  }
  return masked
}

/**
 * Blank HTML COMMENTS. `<!-- </textarea> -->` is not a closer — parse5 consumes
 * it as comment data — yet it satisfied the raw substring search. The
 * unterminated form is blanked to EOF, matching what the tokenizer does with a
 * comment that never ends (and, again, failing closed).
 */
const HTML_COMMENT_RE = /<!--[\s\S]*?-->|<!--[\s\S]*$/g

function blankComments(masked: string, source: string): string {
  HTML_COMMENT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = HTML_COMMENT_RE.exec(source)) !== null) {
    masked = blankRange(masked, m.index, m.index + m[0].length)
    if (m[0].length === 0) HTML_COMMENT_RE.lastIndex++
  }
  return masked
}

/** `> ` / `>` container prefixes, including nested ones (`> > `). */
const BLOCKQUOTE_PREFIX_RE = /^(?: {0,3}>[ \t]?)+/

/**
 * Blank code regions inside BLOCKQUOTES.
 *
 * `FENCE_RE` matches at column 0..3, so a fence inside a quote (```` > ```html ````)
 * is invisible to the top-level tracker — and a blockquoted code sample is an
 * utterly ordinary chat answer ("here's the markup:" followed by a quoted
 * fence). The closer inside it satisfied `hasLaterCloser` and the prose opener
 * above stayed live.
 *
 * CHOSEN APPROACH: strip the quote prefix off each run of quoted lines and run
 * a NESTED tracker (plus the indented-code rule) over the stripped content,
 * blanking only the code regions found. The blunter alternative — blank every
 * `^ {0,3}>` line — is also sound (it only over-blanks) but it would escape a
 * legitimately PAIRED `<textarea>…</textarea>` written inside a blockquote,
 * turning quoted HTML into visible `&lt;…&gt;` source. The nested scan costs
 * one extra line walk and keeps that shape rendering.
 */
function blankQuotedCode(masked: string, lines: MaskLine[]): string {
  let run: MaskLine[] = []
  const flush = () => {
    if (run.length === 0) return
    masked = blankIndentedCode(blankFencedRegions(masked, run), run)
    run = []
  }
  for (const line of lines) {
    const prefix = BLOCKQUOTE_PREFIX_RE.exec(line.content)
    if (!prefix) {
      flush()
      continue
    }
    run.push({
      start: line.start,
      contentStart: line.contentStart + prefix[0].length,
      content: line.content.slice(prefix[0].length),
    })
  }
  flush()
  return masked
}

/**
 * Build the haystack `hasLaterCloser` searches: a LENGTH-PRESERVING lowercased
 * copy of the document with every region that cannot contain a REAL closing
 * tag blanked to spaces.
 *
 * Why this exists: the escaping pass carefully carves code out, but the
 * closer search used to run over the RAW document. So a `</textarea>` sitting
 * inside a code fence, an inline-code span, or another tag's attribute string
 * satisfied "is closed later", the prose opener was left LIVE, and parse5's
 * RAWTEXT span swallowed the rest of the message anyway — the whole fix was
 * one code sample away from being bypassed, which is exactly what an LLM
 * answer about HTML looks like.
 *
 * Masking (rather than deleting) keeps every index identical to the original
 * string, so the caller's offset arithmetic is unchanged. THE LENGTH
 * INVARIANT IS LOAD-BEARING — see `foldAsciiCase`.
 *
 * CARVE DECISION (deliberate, do not "unify"): these tracker-derived regions
 * are NOT fed to the escaping carve, even though that would stop an authored
 * EOF-terminated fence body from rendering as literal `&lt;their&gt;`. The
 * tracker OVER-detects fences inside an open raw-HTML block (a ``` line inside
 * `<pre>` is content, not a fence), and in the carve an over-detected region is
 * a region that is NOT escaped — a fail-OPEN, i.e. exactly the swallow this
 * module exists to prevent. The mask can absorb that same over-detection
 * harmlessly (it only blanks more). So the carve keeps `PROTECTED_SPAN_RE`, and
 * the tradeoff is pinned by the `unclosed-fence-body-renders-escaped` fixture
 * rather than left as prose.
 */
function buildCloserHaystack(text: string): string {
  const folded = foldAsciiCase(text)
  const lines = toMaskLines(folded)
  // 1. Inline code spans (the only regex-derived code region).
  INLINE_CODE_RE.lastIndex = 0
  let masked = folded.replace(INLINE_CODE_RE, (m) => ' '.repeat(m.length))
  // 2. Every BLOCK-level code form, derived from line state over `folded`:
  //    fences (tracker-accurate, closed and EOF-terminated alike), indented
  //    code, blockquoted code, and HTML comments. Each of these carried a
  //    reproduced live-textarea swallow before it was masked.
  masked = blankFencedRegions(masked, lines)
  masked = blankIndentedCode(masked, lines)
  masked = blankQuotedCode(masked, lines)
  masked = blankComments(masked, folded)
  // 3. Attribute regions. Blanking the WHOLE tag would blank real `</tag>`
  //    closers too (and break the closed-form fixtures), so only the
  //    attribute run between the tag name and the `>` is cleared.
  masked = masked.replace(
    TAG_LIKE_REGEX,
    (_m, slash: string, tag: string, rest: string, selfClose: string) =>
      `<${slash}${tag}${' '.repeat(rest.length)}${selfClose}>`,
  )
  return masked
}

/** Exported for the length-preservation invariant test only. */
export const __buildCloserHaystackForTest = buildCloserHaystack

/**
 * True when a well-formed `</tag>` (optional trailing whitespace) occurs at
 * or after `from` in the MASKED lowercased source (see `buildCloserHaystack`).
 * Substring search rather than a per-tag `RegExp` — the tag comes from
 * `RAWTEXT_TAGS`, but building regexes from tag names in a hot path invites
 * an injection footgun on the next edit.
 */
function hasLaterCloser(lowerSource: string, tag: string, from: number): boolean {
  const needle = `</${tag}`
  let cursor = from
  for (;;) {
    const at = lowerSource.indexOf(needle, cursor)
    if (at === -1) return false
    // Only `</tag>` or `</tag   >` closes it; `</tagfoo>` is a different tag.
    if (/^\s*>/.test(lowerSource.slice(at + needle.length, at + needle.length + 64)))
      return true
    cursor = at + needle.length
  }
}

export function escapeUnknownHtmlTags(
  text: string,
  allowedTags: Set<string> = SAFE_HTML_TAGS,
): string {
  if (!text || text.indexOf('<') === -1) return text
  // Masked, length-preserving, lowercased whole-document copy for the RAWTEXT
  // closer lookup — the closer may live in a later segment than the opener,
  // so the search must span the ENTIRE source, not the segment being escaped,
  // and must ignore closers that are only code samples / attribute text.
  const lowerSource = buildCloserHaystack(text)
  // Carve out fenced code blocks AND inline-backtick spans so `<their>`
  // examples inside code are preserved verbatim.
  const parts: string[] = []
  let cursor = 0
  PROTECTED_SPAN_RE.lastIndex = 0
  let span: RegExpExecArray | null
  while ((span = PROTECTED_SPAN_RE.exec(text)) !== null) {
    if (span.index > cursor) {
      parts.push(
        escapeOutsideFences(text.slice(cursor, span.index), allowedTags, lowerSource, cursor),
      )
    }
    parts.push(span[0])
    cursor = span.index + span[0].length
  }
  if (cursor < text.length) {
    parts.push(escapeOutsideFences(text.slice(cursor), allowedTags, lowerSource, cursor))
  }
  return parts.join('')
}

function escapeOutsideFences(
  segment: string,
  allowedTags: Set<string>,
  lowerSource: string,
  segmentOffset: number,
): string {
  return segment.replace(
    TAG_LIKE_REGEX,
    (match, slash: string, tag: string, rest: string, selfClose: string, index: number) => {
      const lower = tag.toLowerCase()
      const escaped = `&lt;${slash}${tag}${rest}${selfClose}&gt;`
      if (!allowedTags.has(lower)) return escaped
      // Allowlisted — but an UNCLOSED RAWTEXT opener would swallow the rest
      // of the document during tokenization, before any allowlist applies.
      if (slash === '' && selfClose === '' && RAWTEXT_TAGS.has(lower)) {
        const afterTag = segmentOffset + index + match.length
        if (!hasLaterCloser(lowerSource, lower, afterTag)) return escaped
      }
      return match
    },
  )
}

// ---------------------------------------------------------------------------
// URL transform
// ---------------------------------------------------------------------------
/**
 * Extends react-markdown's default safe-protocol allowlist with the two
 * internal schemes the chat remark plugins emit (`card://`, `mention://`),
 * for `href` ONLY. All other URLs go through `defaultUrlTransform`.
 */
export function cardAwareUrlTransform(url: string, key: string): string {
  if (key === 'href' && typeof url === 'string' && (url.startsWith('card://') || url.startsWith('mention://')))
    return url
  return defaultUrlTransform(url)
}
