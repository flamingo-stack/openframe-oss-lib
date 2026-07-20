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
import { createFenceTracker, isBlankLine } from '../../../utils/markdown-fences'

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
 * they are allowed to differ — but only in that direction, and that is now
 * ENFORCED rather than assumed: `escapeUnknownHtmlTags` protects only the
 * INTERSECTION of carve and mask, so a span this regex over-detects is escaped
 * instead of sheltered. See the CARVE DECISION note on `buildCloserHaystack`.
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
 * INLINE-CODE region is derived separately, by `findInlineCodeRanges` below —
 * which is no longer a regex and no longer shares this one's length cap.
 */
const PROTECTED_SPAN_RE =
  /^ {0,3}(`{3,}|~{3,})[\s\S]*?^ {0,3}\1[^\n]*$|(`+)[^\n]{0,4096}?\2/gm

/**
 * The INLINE-CODE half of `PROTECTED_SPAN_RE`, on its own — the mask's only
 * non-line-state code region. Everything block-level (fences, indented code,
 * blockquoted code, HTML comments) is derived from line state instead, because
 * a flat regex cannot express CommonMark's closer rules: `PROTECTED_SPAN_RE`
 * ends a fenced span at the FIRST same-marker run even when that run carries an
 * info string (```` ```html ````), which CommonMark forbids on a closer — so the
 * span ended early and the real code content was left unmasked.
 *
 * NO LENGTH CAP, AND NO REGEX (round 16 — SECURITY). This used to be
 * `` /(`+)[^\n]{0,4096}?\1/g ``, sharing `PROTECTED_SPAN_RE`'s 4096-char
 * ReDoS bound. An inline span LONGER than the cap matched NEITHER regex, so the
 * mask simply skipped it — leaving a `</textarea>` written inside that span
 * VISIBLE in the closer haystack, `hasLaterCloser` true, the prose opener LIVE,
 * and parse5 swallowing the rest of the message as the textarea's value.
 * A clean cliff, padding length the only variable: span content ≤4094 chars ⇒
 * blanked, opener escaped, 0 live textareas; ≥4099 ⇒ closer visible, 1 live
 * textarea. That is a fail-OPEN in the security boundary, and it contradicts
 * this module's own contract that every mask approximation "rounds towards
 * blanking".
 *
 * THE BOUND COULD NOT SIMPLY BE DROPPED. `[^\n]` confines backtracking to one
 * LINE, but a single line is not a small input — a chat message can be one.
 * MEASURED (round 16, this repo's vitest env, one line of nothing but
 * backticks — the pathological shape; figures from plain node are within 3%):
 *
 *   input        capped regex        uncapped regex      this linear scan
 *   50K chars    295 ms  (5.9 µs/c)    615 ms (12.3 µs/c)   0.69 ms (14 ns/c)
 *   200K chars  1220 ms  (6.1 µs/c)   9772 ms (48.9 µs/c)   0.42 ms  (2 ns/c)
 *   800K chars  5072 ms  (6.3 µs/c) 158263 ms (198 µs/c)          — (node)
 *
 * The capped regex is flat per char (linear, huge constant); the UNCAPPED one
 * is plainly QUADRATIC — 31x the capped cost at 800KB and still climbing. Every
 * other shape probed (lone tick + text, `` `` `` + text, one tick per 32 chars,
 * one tick per line) is ≈2-4 ns/char in BOTH regex spellings, so the blowup is
 * specific to long backtick runs — which an attacker controls. The cap was load
 * bearing; the REGEX is what had to go. A realistic 260KB backtick-dense
 * message (`Use `foo` and `bar` here.` × 10000) scans in 4.2 ms.
 *
 * `findInlineCodeRanges` is a LINEAR index scan that reproduces the old
 * regex's match semantics exactly (verified by differential fuzz against the
 * uncapped regex) with no backtracking and no cap: per line it collects the
 * backtick RUNS, then for each opener run of length `n` picks the largest
 * closer length `k ≤ n` that occurs later on the line — either inside the same
 * run (needs `n ≥ 2k`, mirroring the regex giving back backticks from a greedy
 * `` (`+) ``) or at the earliest following run of length ≥ k — and takes the
 * EARLIEST such position (the lazy quantifier). The forward walk is amortized
 * O(1) per run because the scan cursor jumps past every run it skipped.
 *
 * `PROTECTED_SPAN_RE` (the CARVE) KEEPS its cap, deliberately: the two
 * consumers round in OPPOSITE directions, see the note on
 * `escapeLeftoverTagStarts`. In the carve, "not known to be code" means ESCAPE,
 * so an over-cap span there costs a code sample rendered as escaped text.
 */
const BACKTICK_CODE = 0x60

function findInlineCodeRanges(source: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  const len = source.length
  let lineStart = 0
  while (lineStart <= len) {
    let lineEnd = source.indexOf('\n', lineStart)
    if (lineEnd === -1) lineEnd = len
    const runStart: number[] = []
    const runLen: number[] = []
    for (let i = lineStart; i < lineEnd; i++) {
      if (source.charCodeAt(i) !== BACKTICK_CODE) continue
      let j = i + 1
      while (j < lineEnd && source.charCodeAt(j) === BACKTICK_CODE) j++
      runStart.push(i)
      runLen.push(j - i)
      i = j - 1
    }
    const n = runStart.length
    if (n > 0) {
      // suffMax[t] = longest run at or after t; 0 past the end.
      const suffMax = new Array<number>(n + 1).fill(0)
      for (let t = n - 1; t >= 0; t--) suffMax[t] = Math.max(runLen[t], suffMax[t + 1])
      let cursor = lineStart
      let idx = 0
      while (idx < n) {
        const runEnd = runStart[idx] + runLen[idx]
        // The scan resumes at the END of the previous match, which can land
        // MID-RUN — exactly as the global regex's `lastIndex` did. The
        // REMAINDER of the run is then an opener in its own right (`` `a`` ``
        // matches twice), so clamp rather than skip.
        if (runEnd <= cursor) {
          idx++
          continue
        }
        const p = Math.max(runStart[idx], cursor)
        const openLen = runEnd - p
        // Largest closer length reachable via a LATER run, and via THIS one.
        const kLater = Math.min(openLen, suffMax[idx + 1])
        const kSame = openLen >> 1
        const k = Math.max(kLater, kSame)
        // No match is possible only when this is the last run and it is a
        // single backtick — every longer run closes on itself, so advancing by
        // one character (what the regex does) cannot find one either.
        if (k < 1) {
          cursor = runEnd
          idx++
          continue
        }
        let q = kSame >= k ? p + k : -1
        if (q === -1)
          for (let t = idx + 1; t < n; t++)
            if (runLen[t] >= k) {
              q = runStart[t]
              break
            }
        ranges.push([p, q + k])
        cursor = q + k
      }
    }
    lineStart = lineEnd + 1
  }
  return ranges
}

/** Exported for the differential fuzz against the retired regex. */
export const __findInlineCodeRangesForTest = findInlineCodeRanges

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
 *    resulting ranges to `masked`. That split is LOAD-BEARING: the inline-code
 *    pass chews a pair of backticks off an unclosed ```` ``` ```` opener (the
 *    opener run gives back backticks until a single one matches the next one as
 *    its closer), so a fence scan over the masked copy sees no fence at all. Both
 *    strings have identical indices, so offsets transfer verbatim.
 *    `blankComments` is the ONE deliberate exception (it is fed the masked
 *    copy, and runs last) — see its docblock for why the reasoning inverts.
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

/**
 * Length-preserving blank of MANY ranges in one pass. Ranges must be
 * non-overlapping and ascending. Folding them through `blankRange` would
 * rebuild the whole document once per range — quadratic on a message with many
 * inline code spans, which is an ordinary LLM answer.
 */
function blankRanges(masked: string, ranges: Array<[number, number]>): string {
  if (ranges.length === 0) return masked
  const parts: string[] = []
  let cursor = 0
  for (const [from, to] of ranges) {
    parts.push(masked.slice(cursor, from), masked.slice(from, to).replace(/[^\n]/g, ' '))
    cursor = to
  }
  parts.push(masked.slice(cursor))
  return parts.join('')
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
 * Blank INDENTED code blocks. A `</textarea>` written as an indented code
 * sample is code, not a closer — but `FENCE_RE` deliberately caps fence indent
 * at 3 spaces, so the tracker never sees these lines.
 *
 * The threshold is LIST-AWARE, not a flat 4 columns. CommonMark measures
 * indented code from the enclosing list item's CONTENT column, so under
 * `1.  ` (content column 4) a 4-space line is a paragraph continuation, not
 * code — and `"1.  Here is a form:\n\n    <textarea>\n    </textarea>\n"` had
 * its closer blanked, `hasLaterCloser` returned false, and a perfectly real
 * element got escaped. A numbered list containing markup is a very ordinary
 * chat answer, so "fail closed" is not a good enough excuse here.
 *
 * The walk mirrors `blankQuotedCode`'s line-state approach: a stack of open
 * list content columns, `code` meaning `indent >= top + 4`. Blank lines keep
 * the state (a list item survives them); a line indented below the top of the
 * stack pops it. A line indented past the code threshold is treated as code
 * BEFORE it is considered as a list marker.
 *
 * SCAN-SOURCE INVERSION (same reasoning as `blankComments`, and NOT the shared
 * contract): the caller must pass lines re-derived from the CURRENT mask, not
 * from `folded`. Fence content is already blanked by `blankFencedRegions`, but
 * that only holds for WRITING the mask — a walk over `folded` still SEES those
 * lines, so a `- x` written inside a fence pushed a content column of 2 and a
 * later top-level column-4 indented-code line then failed `indent >= top + 4`,
 * went unblanked, and its code-sample `</textarea>` kept a prose opener LIVE.
 * Over the masked copy those lines are all spaces, hit the `isBlankLine`
 * continue, preserve list state and push no bogus column.
 *
 * CONTENT-COLUMN CLAMP: CommonMark clamps an item's content column to
 * `markerEnd + 1` when the first block starts MORE than 4 spaces after the
 * marker — the remainder is indented code INSIDE the item. Taking the literal
 * column instead meant `-` + six spaces raised the threshold to 11, so a
 * column-7 `</textarea>` code sample was not blanked.
 *
 * KNOWN OMISSION (deliberate, fail-CLOSED): there is NO paragraph state. Under
 * CommonMark indented code cannot interrupt a paragraph, so a LAZY
 * continuation line — `'Here is a form: <textarea>\nsome paragraph\n    </textarea>\n'`
 * — is paragraph text, yet this walk blanks it as code and the (real, properly
 * closed) element is escaped to visible source. That is cosmetic, and the
 * option NOT taken here is the fail-OPEN direction: skipping the code test in
 * paragraph state means blanking LESS, i.e. more closers visible to
 * `hasLaterCloser` and more openers left live. The list-awareness above was
 * worth its risk because it is unconditional over an entire list item; this
 * one is not, so it is documented rather than implemented.
 */
const LIST_MARKER_RE = /^([ \t]*)(?:[-*+]|\d{1,9}[.)])([ \t]+)(?=\S)/

/** Visual column of `upTo` chars of `line`, expanding tabs to 4-col stops. */
function visualColumn(line: string, upTo: number): number {
  let col = 0
  for (let i = 0; i < upTo; i++) col = line[i] === '\t' ? col + 4 - (col % 4) : col + 1
  return col
}

function leadingIndent(line: string): number {
  const ws = /^[ \t]*/.exec(line)![0]
  return visualColumn(line, ws.length)
}

/** Character index at which `line` reaches visual column `col`, or -1 when the
 *  column falls INSIDE a tab (no exact character boundary) or the line is too
 *  short. The mask is length-preserving, so a container prefix can only ever be
 *  cut at a character boundary; -1 makes the caller decline to strip, which
 *  leaves the line looking indented and therefore blanks MORE (fail-CLOSED). */
function charIndexAtColumn(line: string, col: number): number {
  let c = 0
  for (let i = 0; i < line.length; i++) {
    if (c === col) return i
    c = line[i] === '\t' ? c + 4 - (c % 4) : c + 1
    if (c > col) return -1
  }
  return c === col ? line.length : -1
}

function blankIndentedCode(masked: string, lines: MaskLine[]): string {
  const listContentCols: number[] = []
  for (const line of lines) {
    // CommonMark's blank line (spaces/tabs, `\r`-tolerant), NOT `trim()` — see
    // `isBlankLine`. An NBSP-only line is CONTENT, and skipping it here as
    // "blank" is the same one-character reopening documented there.
    if (isBlankLine(line.content)) continue
    const indent = leadingIndent(line.content)
    const top = listContentCols.length ? listContentCols[listContentCols.length - 1] : 0
    if (indent >= top + 4) {
      masked = blankRange(masked, line.contentStart, line.contentStart + line.content.length)
      continue
    }
    while (listContentCols.length && indent < listContentCols[listContentCols.length - 1])
      listContentCols.pop()
    const marker = LIST_MARKER_RE.exec(line.content)
    if (marker) {
      const markerEndCol = visualColumn(line.content, marker[0].length - marker[2].length)
      const contentCol = visualColumn(line.content, marker[0].length)
      listContentCols.push(contentCol - markerEndCol > 4 ? markerEndCol + 1 : contentCol)
    }
  }
  return masked
}

/** Re-derive scannable lines from the CURRENT mask, preserving each line's
 *  original `start` / `contentStart` (every pass is length-preserving, so the
 *  offsets transfer verbatim). See `blankIndentedCode`'s SCAN-SOURCE
 *  INVERSION. */
function remapToMask(masked: string, lines: MaskLine[]): MaskLine[] {
  return lines.map((line) => ({
    ...line,
    content: masked.slice(line.contentStart, line.contentStart + line.content.length),
  }))
}

/**
 * Blank HTML COMMENTS. `<!-- </textarea> -->` is not a closer — parse5 consumes
 * it as comment data — yet it satisfied the raw substring search. The
 * unterminated form is blanked to EOF, matching what the tokenizer does with a
 * comment that never ends (and, again, failing closed).
 *
 * SCAN-SOURCE EXCEPTION: this is the ONE pass fed the already-masked copy
 * rather than the unmasked one. The shared contract exists because
 * the inline-code pass chews backticks off an unclosed fence opener and would
 * blind a fence scan — but for comments the reasoning INVERTS: a `<!--` inside a code
 * region is not a comment start, and treating it as one blanked the document to
 * EOF. Both `` Use `<!--` to start a comment. `` and a truncated `<!-- todo`
 * inside a ```html fence disabled EVERY later RAWTEXT closer in the message.
 * Running last over the masked copy is safe: all prior passes are
 * length-preserving so offsets still transfer verbatim, a `<!--` inside
 * fenced / inline / indented / quoted code is spaces by now and matches
 * nothing, and a genuine prose comment is untouched by any of them.
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
    // The nested FENCE scan needs the unmasked `run` content (the inline-code
    // pass would have blinded it), but the nested INDENTED scan needs the CURRENT
    // mask — see `blankIndentedCode`'s SCAN-SOURCE INVERSION.
    const afterFences = blankFencedRegions(masked, run)
    masked = blankIndentedCode(afterFences, remapToMask(afterFences, run))
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
 * Blank code regions nested inside LIST ITEMS, the list-container analogue of
 * `blankQuotedCode` (round 14).
 *
 * `FENCE_RE` caps fence indent at 3 columns ABSOLUTE, but CommonMark measures a
 * fence's indent from the enclosing item's CONTENT COLUMN. Every list wrapper
 * the corpus swept had a content column of 2 or 3 (`- `, `1. `), so the cap
 * happened to cover them and the gap was invisible; at content column 4 or more
 * — `-` + three spaces, `1.` + three spaces, or the TAB spelling `-\t`, all
 * ordinary ways to write a list — a fenced code sample inside the item is seen
 * by NO pass. Its `</textarea>` then satisfied `hasLaterCloser`, and a prose
 * `<textarea>` above stayed LIVE and swallowed the rest of the message
 * (reproduced end-to-end at content columns 4 and 5 in BOTH the space and tab
 * spellings; `escapeUnknownHtmlTags` returned the input BYTE-IDENTICAL). The
 * same hole covers a BLOCKQUOTED fence inside such an item, since
 * `blankQuotedCode`'s own `BLOCKQUOTE_PREFIX_RE` is likewise anchored at
 * columns 0..3.
 *
 * Same shape as `blankQuotedCode`: strip the container prefix off each run of
 * lines that share a content column, then run the nested fence + indented scan
 * over the stripped content. The content-column stack is the one
 * `blankIndentedCode` keeps, INCLUDING CommonMark's `markerEnd + 1` clamp and
 * tab expansion, so the two passes cannot disagree about where an item's
 * content begins.
 *
 * FAIL DIRECTION: monotonic. Every pass it calls only ever blanks MORE of the
 * haystack, and more blanking means fewer visible closers, means more openers
 * escaped. So an over-detected run (a list marker written inside a fence
 * pushing a bogus column — the SCAN-SOURCE INVERSION `blankIndentedCode`
 * documents) costs at most a code sample rendered as escaped text.
 */
function blankListItemCode(masked: string, lines: MaskLine[]): string {
  const cols: number[] = []
  let run: MaskLine[] = []
  let runCol = 0
  const flush = () => {
    if (run.length === 0) return
    // The nested FENCE scan needs unmasked content; the nested INDENTED scan
    // needs the CURRENT mask — exactly `blankQuotedCode`'s split. The nested
    // QUOTED scan is needed too: `BLOCKQUOTE_PREFIX_RE` is anchored at columns
    // 0..3, so a quoted fence inside a column-4 item was missed by BOTH
    // containers' passes (`bq-in-col4-item`, reproduced live).
    const afterFences = blankFencedRegions(masked, run)
    masked = blankIndentedCode(afterFences, remapToMask(afterFences, run))
    masked = blankQuotedCode(masked, run)
    run = []
  }
  for (const line of lines) {
    // A blank line does not close a list item, so it stays in the run — the
    // nested tracker needs it to see the paragraph break. CommonMark's blank
    // line, not `trim()` (see `isBlankLine`).
    if (isBlankLine(line.content)) {
      if (run.length > 0) run.push({ ...line, content: '' })
      continue
    }
    const indent = leadingIndent(line.content)
    while (cols.length > 0 && indent < cols[cols.length - 1]) cols.pop()
    const top = cols.length > 0 ? cols[cols.length - 1] : 0
    if (top !== runCol) {
      flush()
      runCol = top
    }
    // Below column 4 the top-level passes already cover the item, so only the
    // runs the fence cap misses are re-scanned.
    if (top >= 4) {
      const cut = charIndexAtColumn(line.content, top)
      if (cut < 0) {
        flush()
        runCol = 0
      } else {
        run.push({
          start: line.start,
          contentStart: line.contentStart + cut,
          content: line.content.slice(cut),
        })
      }
    }
    const marker = LIST_MARKER_RE.exec(line.content)
    if (marker) {
      const markerEndCol = visualColumn(line.content, marker[0].length - marker[2].length)
      const contentCol = visualColumn(line.content, marker[0].length)
      cols.push(contentCol - markerEndCol > 4 ? markerEndCol + 1 : contentCol)
    }
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
 * EOF-terminated fence body from rendering as literal `&lt;their&gt;`.
 *
 * The genuine asymmetry is the EOF-TERMINATED fence, and only that one. The
 * tracker protects an unclosed opener all the way to end of input, so a single
 * stray ``` line — mid-stream, or inside an open raw-HTML block where a ```
 * line is content rather than a fence — would carve the ENTIRE remainder of the
 * document out of the escaping pass. `PROTECTED_SPAN_RE` protects nothing at
 * all there (it only recognizes a fence CLOSED by a same-marker run), so its
 * failure mode is bounded: a code sample renders as escaped text. In the carve
 * an over-detected region is a region that is NOT escaped — a fail-OPEN, i.e.
 * exactly the swallow this module exists to prevent — so the materially larger
 * fail-open surface decides it.
 *
 * SHARED over-detection (e.g. a ``` line inside an HTML block — `<div>`,
 * `<pre>`, `<details>` — where CommonMark says the line is HTML content, not a
 * fence) was previously dismissed here as "not an argument either way". THAT
 * WAS WRONG: it is precisely the residual fail-open. The intersection guard
 * below only reconciles DISAGREEMENT, so when BOTH engines open the same bogus
 * fence the guard is a no-op and a live `<textarea>` inside it is pushed
 * verbatim, swallowing the rest of the message (reproduced for all three tags).
 * What actually closes it is the CARVE BALANCE GUARD in
 * `escapeUnknownHtmlTags`: a protected span may contain no UNBALANCED RAWTEXT
 * opener. Neither engine needs to learn about HTML blocks for that to hold.
 *
 * What makes keeping two engines SAFE is therefore the pair of guards in
 * `escapeUnknownHtmlTags`: a carve span the mask did not blank is escaped
 * rather than pushed through verbatim, and a span carrying an unbalanced
 * RAWTEXT opener is escaped even when both engines agree. Over-detection can
 * then only cost cosmetics. Before the first guard the regex's info-string-tolerant
 * closer let it desync and open a span from a line CommonMark treats as
 * ordinary text, sheltering a live `<textarea>` from escaping entirely
 * (`mismatched-fence-carve-does-not-shelter-opener`). The remaining tradeoff is
 * pinned by `unclosed-fence-body-renders-escaped` rather than left as prose.
 */
function buildCloserHaystack(text: string): string {
  const folded = foldAsciiCase(text)
  const lines = toMaskLines(folded)
  // 1. Inline code spans (the only non-line-state code region). Uncapped and
  //    backtracking-free — see `findInlineCodeRanges`; an over-cap span used to
  //    be skipped entirely and sheltered a live RAWTEXT opener.
  let masked = blankRanges(folded, findInlineCodeRanges(folded))
  // 2. Every BLOCK-level code form, derived from line state over `folded`:
  //    fences (tracker-accurate, closed and EOF-terminated alike), indented
  //    code, blockquoted code, and HTML comments. Each of these carried a
  //    reproduced live-textarea swallow before it was masked.
  masked = blankFencedRegions(masked, lines)
  //    The indented pass walks the CURRENT mask (not `folded`) so a list marker
  //    written inside a fence cannot shift its content-column stack — see its
  //    SCAN-SOURCE INVERSION note. `blankQuotedCode` still gets the unmasked
  //    lines because its NESTED fence scan needs them, and applies the same
  //    inversion internally.
  masked = blankIndentedCode(masked, remapToMask(masked, lines))
  masked = blankQuotedCode(masked, lines)
  //    …and the LIST-container analogue, for items whose content column exceeds
  //    the 3-column fence-indent cap. Monotonic, so its position among the
  //    block passes is not load-bearing.
  masked = blankListItemCode(masked, lines)
  // Comments scan the MASKED copy, not `folded` — see `blankComments`. Must
  // stay LAST: it relies on every code region already being blanked.
  masked = blankComments(masked, masked)
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

/**
 * True when the mask considers `[from, to)` entirely code — every character
 * blanked to a space (newlines are never blanked, so they count as blank).
 * Both strings are the same length by construction (see `foldAsciiCase`).
 */
function isMaskedBlank(lowerSource: string, from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    const c = lowerSource[i]
    if (c !== ' ' && c !== '\n') return false
  }
  return true
}

/**
 * True when `span` contains a RAWTEXT opener with no matching closer INSIDE
 * the span — the self-containment test the carve applies before pushing a
 * protected span through verbatim. See the CARVE BALANCE GUARD in
 * `escapeUnknownHtmlTags`.
 *
 * A closer with no opener before it is harmless (it cannot start a RAWTEXT
 * span), so the counter floors at zero rather than going negative.
 *
 * SELF-CLOSING IS AN OPENER (round 11). HTML ignores the self-closing flag on
 * non-void, non-foreign elements, so parse5 tokenizes `<textarea/>` as a START
 * tag and enters RAWTEXT exactly like `<textarea>`. Keying on `selfClose === ''`
 * therefore made this guard — and the closer check in `escapeOutsideFences` —
 * blind to the self-closed spelling of EVERY shape they defend against; the
 * round-9 HTML-block fixtures passed only because they used the bare spelling.
 * See the matching note on `escapeOutsideFences` for the one cosmetic cost.
 */
function hasUnbalancedRawtextOpener(span: string): boolean {
  if (span.indexOf('<') === -1) return false
  const open = new Map<string, number>()
  TAG_LIKE_REGEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TAG_LIKE_REGEX.exec(span)) !== null) {
    const [, slash, tag] = m
    const lower = tag.toLowerCase()
    if (!RAWTEXT_TAGS.has(lower)) continue
    if (slash === '') {
      open.set(lower, (open.get(lower) ?? 0) + 1)
    } else {
      open.set(lower, Math.max(0, (open.get(lower) ?? 0) - 1))
    }
  }
  for (const count of open.values()) if (count > 0) return true
  return false
}

/**
 * ---------------------------------------------------------------------------
 * CommonMark HTML BLOCK ranges — the property the CARVE BALANCE GUARD gates on
 * ---------------------------------------------------------------------------
 * The guard exists because a protected span sitting inside an HTML BLOCK is not
 * really code: CommonMark says an HTML block runs to its own terminator, so
 * every line inside it is HTML CONTENT. Round 9 discovered that through the
 * FENCE spelling (a ``` line inside `<div>` is content, but both fence engines
 * call it a fence and shelter what follows). Round 11 then scoped the guard to
 * fences — and reopened the identical hole through INLINE CODE, whose
 * "an inline span can shelter nothing, remark emits it as an `inlineCode` TEXT
 * node" justification is precisely the invariant that fails inside an HTML
 * block, where remark emits raw HTML and backticks are not code at all.
 *
 * Gating on the span's FLAVOR was therefore the wrong property in both
 * directions. This walk supplies the right one: HTML-block membership, which
 * covers both spellings, while `` Use the `<title>` element `` in ordinary
 * prose keeps rendering verbatim (round 11's regression stays fixed).
 *
 * FAIL DIRECTION: a detected range only makes the guard ESCAPE a span, and
 * escaping inside a GENUINE HTML block is invisible (the surrounding content is
 * raw HTML, where `&lt;` is decoded as `<`). Over-detection is therefore
 * cosmetic ONLY when we are wrong about the block — so the walk tracks
 * CommonMark closely rather than blanket-detecting.
 *
 * START CONDITIONS IMPLEMENTED: all seven (1 `<script|pre|style|textarea`,
 * 2 `<!--`, 3 `<?`, 4 `<!LETTER`, 5 `<![CDATA[`, 6 the known block-tag list,
 * 7 a complete open/closing tag ALONE on its line). Condition 7 is the one that
 * needs paragraph state — it alone cannot interrupt a paragraph — and it is NOT
 * omissible: `<span>` is outside both the type-1 and type-6 tag lists, so
 * dropping 7 would leave `` <span>\n`<textarea>`\n</span> `` sheltering a live
 * opener (verified end-to-end before this walk existed). Paragraph state is
 * approximated by "the previous line was ordinary text", which is exact for the
 * shapes 7 cares about; where it errs it errs toward NOT being in a paragraph,
 * i.e. toward detecting a block, i.e. toward escaping.
 *
 * This walk is deliberately SEPARATE from the mask's line walk. The mask is the
 * closer-search security boundary and currently over-blanks a ``` line inside an
 * HTML block (fail-CLOSED there); teaching it about HTML blocks would UNBLANK
 * that region and turn a code-sample `</textarea>` into a live closer — the
 * fail-OPEN direction. Same line-state concept, opposite fail directions, so
 * they stay two walks.
 */
interface HtmlBlockRange {
  start: number
  end: number
}

/** CommonMark start-condition 6 tag list (verbatim from the spec). */
const HTML_BLOCK_TYPE_6_TAGS = new Set([
  'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body',
  'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir',
  'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
  'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem',
  'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'search',
  'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'title', 'tr', 'track', 'ul',
])

const HTML_BLOCK_START_1 = /^ {0,3}<(?:script|pre|style|textarea)(?:[ \t>]|\r?$)/i
const HTML_BLOCK_END_1 = /<\/(?:script|pre|style|textarea)>/i
const HTML_BLOCK_START_2 = /^ {0,3}<!--/
const HTML_BLOCK_START_3 = /^ {0,3}<\?/
const HTML_BLOCK_START_4 = /^ {0,3}<![a-zA-Z]/
const HTML_BLOCK_START_5 = /^ {0,3}<!\[CDATA\[/
const HTML_BLOCK_START_6 = /^ {0,3}<(\/?)([a-zA-Z][a-zA-Z0-9-]{0,63})(?:[ \t]|\/?>|\r?$)/
/** A COMPLETE open or closing tag, alone on its line. Attribute run bounded for
 *  the same ReDoS reason as `TAG_LIKE_REGEX`. */
const HTML_BLOCK_START_7 =
  /^ {0,3}(?:<[a-zA-Z][a-zA-Z0-9-]{0,63}(?:\s[^>]{0,4096}?)?\/?>|<\/[a-zA-Z][a-zA-Z0-9-]{0,63}[ \t]{0,64}>)[ \t]*\r?$/
/** Lines that are NOT ordinary paragraph text (so condition 7 may start after
 *  them). A lone tag line is deliberately ABSENT: under CommonMark it cannot
 *  interrupt a paragraph, so it continues one. */
const NON_PARAGRAPH_LINE_RE =
  /^ {0,3}(?:#{1,6}(?:[ \t]|\r?$)|>|[-*+](?:[ \t]|\r?$)|\d{1,9}[.)](?:[ \t]|\r?$)|`{3,}|~{3,}|=+[ \t]*\r?$|(?:[-*_][ \t]*){3,}\r?$)/

/**
 * CONTAINER NORMALIZATION (round 13). Every start/end condition above is
 * anchored `^ {0,3}<…` and used to be matched against the RAW line, so inside a
 * BLOCKQUOTE or a LIST ITEM none of them ever fired — `> <div>` / `- <div>`
 * looked like ordinary text. CommonMark opens the block INSIDE the container, so
 * every following line is HTML content; the walk missed the whole range, the
 * balance guard stayed blind, and `` > `<textarea>` `` was pushed through
 * VERBATIM (`escapeUnknownHtmlTags` returned the input byte-identical).
 *
 * Detection here only ever causes ESCAPING, so a CONSERVATIVE strip is enough
 * and no container-stack model is needed: stripping more than CommonMark would
 * can only over-detect, and over-detection inside a genuine HTML block is
 * invisible (see FAIL DIRECTION above), while under-detection is the swallow.
 *
 * WHAT THIS MODELS: any run of blockquote markers (`>` with up to 3 spaces of
 * indent and one optional space after), then at most one list marker
 * (`-`/`*`/`+`/`1.`/`1)` plus its following spaces), then — for CONTINUATION
 * lines — up to `listContentCol` columns of leading whitespace, where
 * `listContentCol` is the width of the most recent list marker seen at the
 * current level.
 *
 * WHAT IT DOES NOT MODEL, and why the residual is fail-CLOSED:
 *  - It keeps NO container stack, so it cannot tell a lazy-continuation line
 *    from a line that genuinely left the container, and it does not verify that
 *    a stripped prefix matches the prefix the enclosing block actually opened
 *    with. Both errors strip TOO MUCH, i.e. detect MORE blocks, i.e. escape.
 *  - `listContentCol` takes the literal marker width and does NOT apply
 *    CommonMark's clamp to `markerEnd + 1` when the first block starts more than
 *    4 spaces after the marker. Under `-` + six spaces the real content column
 *    is 2 and the remainder is indented code INSIDE the item; we strip 7 and may
 *    call an indented-code line a block start. Again: more detection.
 *  - TERMINATION strips by prefix WIDTH, not by prefix IDENTITY (see the
 *    `blank` computation): a line carrying a different container's marker
 *    within the opening line's prefix width and nothing after it still reads as
 *    blank. That shape is a lone container marker at or left of the opening
 *    content column, which under CommonMark closes the enclosing container (and
 *    with it the HTML block) anyway — so the two agree on every shape checked.
 *    It is the ONE bullet here whose error direction is under-detection, and it
 *    is why the width is taken from the OPENING line rather than from a greedy
 *    re-strip of each line.
 *  - Offsets are NOT rewritten: `start` / `lastEnd` stay in the ORIGINAL
 *    coordinate space (the stripped prefix is discarded, never subtracted), so
 *    the ranges remain valid for the caller's overlap test. Line-granular
 *    coordinates are sufficient there — `spanInsideHtmlBlock` only asks whether
 *    a span intersects a range.
 *
 * TABS ARE EXPANDED TO 4-COLUMN STOPS FIRST (round 14). Every measurement here
 * is a COLUMN count, and CommonMark measures columns, so the walk cannot be fed
 * raw characters. Round 13 admitted the gap as a bounded residual and argued it
 * was fail-CLOSED; that argument was WRONG and the residual was exploitable.
 * `-\t-\tfoo` opens a list item whose real content column is 8 (each tab
 * advances to the next multiple of 4), but the character count is 4, so a
 * continuation line indented 8 spaces was stripped by only 4 and still looked
 * indented by 4 — `^ {0,3}<…` missed, `kind` stayed `null`, no range was
 * recorded, the balance guard never fired, and a live `<iframe>` / a swallowing
 * `<textarea>` reached the DOM inside a protected span (`escapeUnknownHtmlTags`
 * returned the input BYTE-IDENTICAL). `expandTabs` closes it: after expansion
 * the line contains no tabs at all, so `^ {0,3}` and every `[ \t]` class below
 * see true columns. Its arithmetic is the same 4-column stop rule as the mask's
 * `visualColumn`, so the two walks agree on what a column is.
 *
 * The blockquote half reuses `BLOCKQUOTE_PREFIX_RE` — the mask's existing
 * blockquote-stripping SSOT — so the two walks agree on what a quote marker is.
 */
const LIST_MARKER_PREFIX_RE = /^[ \t]{0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]{1,64}|\r?$)/

/** Expand tabs to 4-column tab stops, so character offsets in the result ARE
 *  columns. Same stop rule as `visualColumn` (the mask's SSOT for this). */
function expandTabs(s: string): string {
  if (s.indexOf('\t') === -1) return s
  let out = ''
  for (const ch of s) out += ch === '\t' ? ' '.repeat(4 - (out.length % 4)) : ch
  return out
}

interface NormalizedLine {
  /** The line with its container prefix removed (start/end conditions match this). */
  text: string
  /** Content column of a list marker this line OPENED, or -1 if it opened none. */
  openedListCol: number
}

/** `rawLine` is expanded to column stops FIRST, so every length taken below is a
 *  column count. Callers that compare against the input must compare against
 *  `expandTabs(rawLine)`, not `rawLine` — see `computeHtmlBlockRanges`. */
function stripContainerPrefix(rawLine: string, listContentCol: number): NormalizedLine {
  const line = expandTabs(rawLine)
  let rest = line
  let openedListCol = -1
  // The enclosing item's continuation indent, consumable ONCE.
  let indentBudget = listContentCol
  // Containers nest in either order (`- > <div>`, `> - <div>`), so alternate
  // until nothing more is consumed. Bounded so a pathological line of markers
  // cannot make this super-linear.
  for (let depth = 0; depth < 16; depth++) {
    const bq = BLOCKQUOTE_PREFIX_RE.exec(rest)
    if (bq !== null && bq[0].length > 0) {
      rest = rest.slice(bq[0].length)
      if (openedListCol >= 0) openedListCol = line.length - rest.length
      continue
    }
    const li = LIST_MARKER_PREFIX_RE.exec(rest)
    if (li !== null) {
      rest = rest.slice(li[0].length)
      openedListCol = line.length - rest.length
      continue
    }
    // Continuation line of the open list item: drop up to the content column of
    // leading whitespace (never more, and never non-whitespace) — then KEEP
    // PEELING. Round 13 consumed this indent after the loop and returned, so a
    // container opened INSIDE the item (`-\\t> <div>` continued by `    > <div>`)
    // kept its `>` and no start condition could match: the range was missed and
    // the balance guard went blind, exactly the round-13 symptom one level down.
    // Both markers are anchored `^ {0,3}`, so the indent MUST come off first for
    // either to be seen. Guarded on "this line opened no list marker", which is
    // what makes it a continuation line at all.
    if (openedListCol < 0 && indentBudget > 0) {
      let i = 0
      while (i < indentBudget && i < rest.length && rest[i] === ' ') i++
      indentBudget = 0
      if (i > 0) {
        rest = rest.slice(i)
        continue
      }
    }
    break
  }
  return { text: rest, openedListCol }
}

/**
 * `line` MUST be the CONTAINER-NORMALIZED text (`norm.text`), not the raw line.
 * Kind 4's end condition is a bare `>`, which EVERY blockquote prefix contains —
 * fed the raw line, `> <!DOCTYPE html` self-terminated on its own start line, so
 * the range was never recorded and the balance guard went blind for the rest of
 * the block. Kinds 1/2/3/5 cannot have their closers inside a container prefix,
 * so for them the two are equivalent; passing `norm.text` uniformly removes the
 * asymmetry rather than documenting it as a fifth under-detection residual.
 */
function htmlBlockEnds(kind: number, line: string): boolean {
  switch (kind) {
    case 1:
      return HTML_BLOCK_END_1.test(line)
    case 2:
      return line.indexOf('-->') !== -1
    case 3:
      return line.indexOf('?>') !== -1
    case 4:
      return line.indexOf('>') !== -1
    default:
      return line.indexOf(']]>') !== -1
  }
}

function htmlBlockStartKind(line: string, inParagraph: boolean): number | null {
  if (line.indexOf('<') === -1) return null
  if (HTML_BLOCK_START_1.test(line)) return 1
  if (HTML_BLOCK_START_2.test(line)) return 2
  if (HTML_BLOCK_START_3.test(line)) return 3
  if (HTML_BLOCK_START_5.test(line)) return 5
  if (HTML_BLOCK_START_4.test(line)) return 4
  const six = HTML_BLOCK_START_6.exec(line)
  if (six && HTML_BLOCK_TYPE_6_TAGS.has(six[2].toLowerCase())) return 6
  // Condition 7 is the ONLY one that cannot interrupt a paragraph.
  if (!inParagraph && HTML_BLOCK_START_7.test(line)) return 7
  return null
}

function computeHtmlBlockRanges(text: string): HtmlBlockRange[] {
  if (text.indexOf('<') === -1) return []
  const ranges: HtmlBlockRange[] = []
  const fences = createFenceTracker()
  let kind: number | null = null
  let start = 0
  let lastEnd = 0
  let inParagraph = false
  let offset = 0
  // Container state for the normalization above. `listContentCol` is the width
  // of the innermost list marker seen; `openPrefixLen` is how many prefix
  // COLUMNS the CURRENTLY open block consumed on its OPENING line, which decides
  // whose notion of "blank line" terminates a type-6/7 block (see below).
  let listContentCol = 0
  let openPrefixLen = 0
  for (const line of text.split('\n')) {
    const lineStart = offset
    const lineEnd = offset + line.length
    offset = lineEnd + 1
    // Columns, not characters (see `expandTabs`). Every comparison against "the
    // line as written" below must use THIS, or a tab-prefixed container reads as
    // a container that opened nothing.
    const expanded = expandTabs(line)
    const norm = stripContainerPrefix(expanded, listContentCol)
    if (norm.openedListCol >= 0) listContentCol = norm.openedListCol
    else if (!isBlankLine(norm.text) && norm.text === expanded) listContentCol = 0
    const normBlank = isBlankLine(norm.text)
    // A type-6/7 block ends at the first blank line. At top level the raw line
    // decides — a bare `-` or `>` line inside a top-level HTML block is CONTENT,
    // and treating it as blank would END the range early (the one
    // under-detecting direction).
    //
    // Inside a container the container's own filler (`>`, `> >`, the item's
    // indent) IS that blank line, so the block must end there — but ONLY the
    // filler of the container the block actually opened in. Round 13 used the
    // fully-stripped `norm.text` here, and `stripContainerPrefix` strips ANY
    // container markers, not the ones that were open. So a line holding a
    // DIFFERENT container's opener (`  >` under a `- <div>`, `> -` under a
    // `> <div>`) normalized to empty, read as blank, and ended the range early —
    // re-opening the very shelter the range exists to expose (verified: 1 live
    // `<textarea>`, where the same input WITHOUT the filler line rendered 0).
    // Under CommonMark that line is HTML content and the block continues.
    //
    // So termination strips at most the OPENING line's prefix width: `  >`
    // minus 2 columns is `>`, non-blank, block continues; a genuine filler (`>`
    // under `> `, two spaces under `- `) still normalizes to empty and still
    // terminates. Measured in expanded columns, consistently with `expandTabs`.
    // `isBlankLine`, NOT `trim()`. This is THE place the distinction bit: an
    // NBSP / VT / FF / BOM filler line ended a tracked type-6/7 range while
    // remark kept the HTML block open, so the inline-code shelter below it
    // stopped being "inside a tracked block", the balance guard went blind, and
    // a live `<textarea>` / third-party `<iframe>` reached the DOM
    // (`escapeUnknownHtmlTags` returned the input BYTE-IDENTICAL). One
    // invisible character reopened the whole shelter class.
    const blank =
      openPrefixLen > 0 ? isBlankLine(expanded.slice(openPrefixLen)) : isBlankLine(line)
    if (kind !== null) {
      // Types 6 and 7 end at (and EXCLUDE) the first blank line; 1..5 end on
      // the line that satisfies their closer, INCLUSIVE.
      if (kind >= 6) {
        if (blank) {
          ranges.push({ start, end: lastEnd })
          kind = null
          openPrefixLen = 0
          inParagraph = false
          continue
        }
        lastEnd = lineEnd
        continue
      }
      lastEnd = lineEnd
      if (htmlBlockEnds(kind, norm.text)) {
        ranges.push({ start, end: lineEnd })
        kind = null
        openPrefixLen = 0
        inParagraph = false
      }
      continue
    }
    // Outside a block: keep fence state, so a start condition written inside a
    // genuine fenced code sample cannot open one. Fed the RAW line ON PURPOSE —
    // the tracker is a shared CommonMark machine with two other consumers and
    // feeding it normalized lines would let a `>`-prefixed delimiter INSIDE a
    // top-level fence close it early. The cost is that a fence written inside a
    // blockquote is invisible here, so its content lines can open a bogus block:
    // more detection, i.e. the fail-CLOSED direction.
    if (fences.push(line) !== 'text') {
      inParagraph = false
      continue
    }
    const started = htmlBlockStartKind(norm.text, inParagraph)
    if (started !== null) {
      inParagraph = false
      // 1..5 may satisfy their end condition on the START line itself.
      if (started < 6 && htmlBlockEnds(started, norm.text)) {
        ranges.push({ start: lineStart, end: lineEnd })
        continue
      }
      kind = started
      openPrefixLen = expanded.length - norm.text.length
      start = lineStart
      lastEnd = lineEnd
      continue
    }
    // Paragraph state uses the NORMALIZED blank: a container's own filler line
    // (`>`, `> >`) separates paragraphs inside the container. Erring toward
    // "not in a paragraph" only ENABLES the type-7 start condition — more
    // detection, the fail-CLOSED direction.
    inParagraph =
      !normBlank && leadingIndent(norm.text) < 4 && !NON_PARAGRAPH_LINE_RE.test(norm.text)
  }
  // An unterminated block runs to end of input, exactly as the tokenizer treats it.
  if (kind !== null) ranges.push({ start, end: lastEnd })
  return ranges
}

/**
 * Tag-like starts the MAIN pass could not consume — `TAG_LIKE_REGEX` hard-bounds
 * its attribute run at 4096 chars (ReDoS hardening), so a longer run makes the
 * whole tag fail to match and NEITHER the allowlist NOR the RAWTEXT closer check
 * ever runs: a live `<iframe src="data:text/html;base64,…4KB+…">` reached the DOM
 * verbatim. The cap must stay (removing it reintroduces the backtracking blowup),
 * so instead an over-long tag FAILS CLOSED here: only its `<` is escaped, which
 * degrades it to visible text rather than a live opener.
 *
 * Applied ONLY to the gaps BETWEEN main-pass matches, so a tag the main pass
 * already decided on can never be touched twice (no `&amp;lt;`).
 *
 * Shape is deliberately trivial — one bounded quantifier over disjoint character
 * classes and a single-char lookahead, so there is no alternation to backtrack
 * across and failure costs at most 64 steps per candidate `<`.
 *
 * MEASURED COST (round 12, this repo's vitest/jsdom env, `escapeUnknownHtmlTags`
 * over a document of nothing but max-length never-closed tag names — the
 * pathological shape for this pass): 61.2 / 122.1 / 257.2 / 492.2 ms at 325KB /
 * 650KB / 1.3MB / 2.6MB. Dead linear at ~190 ns/char, so there is no
 * algorithmic blowup — only a large constant on an input no real message has.
 * Realistic chat/post output (≤256KB) lands around 50ms. An earlier note in the
 * remediation record claimed 5.2ms for the 1.3MB case; that figure was wrong by
 * ~50x and is corrected here.
 *
 * NOT APPLIED INSIDE CODE (round 12). The candidate shape here is ANY
 * `<[a-zA-Z…]` followed by whitespace or `>`, not just the over-long tag it was
 * written for — so ordinary pseudo-code (`    if a <b then` in an indented
 * block) was escaped to a visible `&lt;`, since entity references are NOT
 * decoded inside code. That is the very argument that scoped the balance guard
 * away from inline code, applied here. The MASK already knows which regions are
 * code and the offsets are exact, so each candidate is checked against it
 * individually (per-candidate, not per-gap: a gap routinely spans both prose and
 * code).
 *
 * THE 4096-CHAR CAP HAS TWO CONSUMERS THAT ROUND IN OPPOSITE DIRECTIONS — and
 * getting that asymmetry wrong is what hid a live fail-open for six review
 * rounds (round 16). "This span is not KNOWN to be code" means:
 *
 *   consumer                       | not-known-to-be-code ⇒ | fail direction
 *   -------------------------------|------------------------|---------------
 *   this pass (`isMaskedBlank`)    | ESCAPE the `<`         | CLOSED (cosmetic:
 *                                  |                        | a visible `&lt;`)
 *   the CARVE (`PROTECTED_SPAN_RE`)| ESCAPE the span        | CLOSED (cosmetic:
 *                                  |                        | code renders as
 *                                  |                        | escaped text)
 *   the MASK's closer haystack     | ADMIT a `</tag>` closer| **OPEN** (a live
 *   (`hasLaterCloser`)             |                        | RAWTEXT opener
 *                                  |                        | swallows the rest
 *                                  |                        | of the message)
 *
 * The previous version of this note analysed the over-cap span for THIS pass
 * only, concluded "the safe direction", and stopped — true here, false for the
 * haystack, where the identical cap silently un-blanked a `</textarea>` written
 * inside an over-long inline span and re-opened the RAWTEXT swallow this module
 * exists to close. A residual note must state the fail direction PER CONSUMER;
 * a single "safe direction" verdict for a value read by passes that round
 * opposite ways is not a finding, it is an averaging error.
 *
 * RESOLVED for the haystack: the mask no longer uses a capped regex at all
 * (`findInlineCodeRanges` — linear, uncapped), so an over-long inline span is
 * blanked like any other and the haystack's fail-OPEN row above no longer has
 * an over-cap case. Pinned by the `spanLength` axis of the swallow sweep
 * (cap−k and cap+k for every shelter spelling).
 * RESIDUAL, deliberately kept: the CARVE keeps its cap, and so does this pass's
 * view of an over-cap span in a document the mask ALSO declines to blank — both
 * of those round CLOSED per the table, i.e. they cost at worst a visible `&lt;`.
 */
const LEFTOVER_TAG_START_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]{0,63})(?=[\s>])/g

function escapeLeftoverTagStarts(gap: string, lowerSource: string, gapOffset: number): string {
  if (gap.indexOf('<') === -1) return gap
  LEFTOVER_TAG_START_RE.lastIndex = 0
  return gap.replace(
    LEFTOVER_TAG_START_RE,
    (m: string, slash: string, tag: string, at: number) =>
      isMaskedBlank(lowerSource, gapOffset + at, gapOffset + at + m.length)
        ? m
        : `&lt;${slash}${tag}`,
  )
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
  // HTML-block ranges for the CARVE BALANCE GUARD below. Computed LAZILY: only
  // a protected span that actually carries an unbalanced RAWTEXT opener needs
  // them, which no ordinary message has.
  let htmlBlocks: HtmlBlockRange[] | null = null
  const spanInsideHtmlBlock = (from: number, to: number): boolean => {
    htmlBlocks ??= computeHtmlBlockRanges(text)
    return htmlBlocks.some((r) => r.start < to && r.end > from)
  }
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
    // INTERSECTION GUARD (soundness, not an instance patch). A protected span
    // is pushed through VERBATIM, so a live RAWTEXT opener inside one never
    // reaches `escapeOutsideFences` at all and the mask's correctness is
    // bypassed. Carve and mask run different engines, so the carve CAN protect
    // a region the mask correctly blanked — `PROTECTED_SPAN_RE`'s closer
    // alternative accepts an info string, ends its span early, desyncs, and can
    // open a new span from a line CommonMark treats as ordinary text. Protect
    // only what BOTH engines call code: if the mask left anything non-blank
    // over this exact range, escape the span instead.
    //
    // CARVE BALANCE GUARD (the residual fail-open the intersection alone does
    // NOT close). The intersection only reconciles DISAGREEMENT; when BOTH
    // engines over-detect the SAME region it is a no-op. CommonMark says an
    // HTML block (type 1 `<pre>`/`<details>`, type 6 `<div>`) runs to its
    // terminator, so a ``` line inside one is HTML CONTENT and not a fence —
    // and NEITHER `createFenceTracker` nor `PROTECTED_SPAN_RE` models HTML
    // blocks, so both open a bogus fence at the same line and shelter whatever
    // follows. So the range check is paired with a self-containment check: a
    // protected span is by definition a complete code region, therefore any
    // RAWTEXT opener inside it must be BALANCED within it. An unbalanced one
    // means the span is not really code — route it through the escaper. This
    // is engine-independent (it needs no HTML-block tracking).
    //
    // GATED ON HTML-BLOCK MEMBERSHIP, NOT ON THE SPAN'S FLAVOR (round 12). The
    // property that makes a protected span "not really code" is that it sits
    // inside an HTML BLOCK — where CommonMark says every line is HTML content.
    // Two earlier rounds gated on flavor instead and traded one hole for the
    // other:
    //  - round 9 applied the guard to BOTH alternatives. That over-applied to
    //    inline code, where entity references are NOT recognized, so an escaped
    //    `&lt;title&gt;` was shown to the reader LITERALLY — and naming a tag in
    //    inline code (`` `<title>` ``) is the single most common way a docs
    //    answer mentions one.
    //  - round 11 scoped it to FENCES, justified by "an inline span cannot
    //    shelter a live opener: remark emits it as an `inlineCode` TEXT node, so
    //    parse5 never tokenizes its content". That invariant is asserted in a
    //    comment and holds only OUTSIDE an HTML block. Inside one, remark emits
    //    raw HTML, backticks are not code, and `` `<textarea>` `` on its own
    //    line inside `<div>` / `<pre>` / `<details>` / `<span>` sheltered a live
    //    opener that swallowed the rest of the message.
    // Membership covers BOTH spellings with one property, and leaves ordinary
    // prose inline code untouched. `isFence` is kept as an independent
    // sufficient condition: a fenced span that the mask blanked but the HTML
    // walk does not consider part of a block (the two engines can still desync)
    // must stay under the round-9 guarantee.
    // Group 1 is the fence marker, group 2 the inline backtick run.
    //
    // PROPERTY GUARANTEED: no protected span that is either a FENCE or inside an
    // HTML BLOCK can carry an unbalanced RAWTEXT opener into the output
    // verbatim. That is strictly weaker than "the carve never over-detects" — an
    // over-detected span with no RAWTEXT opener in it is still pushed verbatim,
    // which stays cosmetic-only.
    const isFence = span[1] !== undefined
    const spanEnd = span.index + span[0].length
    parts.push(
      isMaskedBlank(lowerSource, span.index, spanEnd) &&
        !(
          hasUnbalancedRawtextOpener(span[0]) &&
          (isFence || spanInsideHtmlBlock(span.index, spanEnd))
        )
        ? span[0]
        : escapeOutsideFences(span[0], allowedTags, lowerSource, span.index),
    )
    cursor = span.index + span[0].length
  }
  if (cursor < text.length) {
    parts.push(escapeOutsideFences(text.slice(cursor), allowedTags, lowerSource, cursor))
  }
  return parts.join('')
}

/**
 * Walks `segment` tag by tag rather than using `String.replace`, so the regions
 * the main regex did NOT consume are addressable: each gap is handed to
 * `escapeLeftoverTagStarts` (see it for the over-long-attribute fail-open it
 * closes), while every matched tag keeps its ORIGINAL index. Preserving that
 * index matters — `hasLaterCloser` indexes `lowerSource`, which is built from
 * the untouched text, so any offset drift reopens the round-5 desync class.
 */
function escapeOutsideFences(
  segment: string,
  allowedTags: Set<string>,
  lowerSource: string,
  segmentOffset: number,
): string {
  const out: string[] = []
  let cursor = 0
  TAG_LIKE_REGEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TAG_LIKE_REGEX.exec(segment)) !== null) {
    const [match, slash, tag, rest, selfClose] = m
    if (m.index > cursor)
      out.push(
        escapeLeftoverTagStarts(
          segment.slice(cursor, m.index),
          lowerSource,
          segmentOffset + cursor,
        ),
      )
    const lower = tag.toLowerCase()
    const escaped = `&lt;${slash}${tag}${rest}${selfClose}&gt;`
    if (!allowedTags.has(lower)) {
      out.push(escaped)
    } else if (slash === '' && RAWTEXT_TAGS.has(lower)) {
      // Allowlisted — but an UNCLOSED RAWTEXT opener would swallow the rest of
      // the document during tokenization, before any allowlist applies.
      //
      // The SELF-CLOSED spelling counts as an opener (round 11): HTML ignores
      // the self-closing flag on non-void, non-foreign elements, so parse5
      // tokenizes `<textarea/>` as a start tag and enters RAWTEXT identically.
      // Excluding it here left the entire defense — prose openers, HTML-block
      // shelters, all of it — bypassable by one extra slash. `RAWTEXT_TAGS` has
      // no void members, so nothing legitimate self-closes.
      //
      // COSMETIC COST (accepted, fail-closed): self-closing IS honored in
      // foreign content, so an EMPTY `<title/>` inside `<svg>` now escapes
      // rather than rendering. It carries no accessible name either way, and
      // the real a11y form `<title>Chart</title>` is unaffected. SECOND COST
      // added by the same round: a protected span the balance guard deems
      // not-really-code is routed through this function whole, so bare `<tag`
      // starts in its GAPS are escaped too — the mask check in
      // `escapeLeftoverTagStarts` keeps that off genuine code regions.
      const afterTag = segmentOffset + m.index + match.length
      out.push(hasLaterCloser(lowerSource, lower, afterTag) ? match : escaped)
    } else {
      out.push(match)
    }
    cursor = m.index + match.length
  }
  if (cursor < segment.length)
    out.push(escapeLeftoverTagStarts(segment.slice(cursor), lowerSource, segmentOffset + cursor))
  return out.join('')
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
