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

/**
 * PARAGRAPH SEGMENTS, NOT LINES (round 18 — SECURITY). A CommonMark code span
 * CROSSES LINE BREAKS: `` `foo\n</textarea>` `` is one `inlineCode` node, so
 * that `</textarea>` is a code sample and not a closer — yet this scan (and
 * `PROTECTED_SPAN_RE`, whose body class is `[^\n]`) was strictly PER LINE, so
 * the mask never saw the span, the closer stayed visible in the haystack,
 * `hasLaterCloser` returned true, and a prose `<textarea>` above it stayed LIVE
 * (`escapeUnknownHtmlTags` returned the input BYTE-IDENTICAL; the renderer
 * emitted `<code>foo </textarea></code>` — proving the closer is a code sample
 * — beside a live textarea swallowing the prose). This is the shape that is not
 * a CONTAINER at all, so no container sweep could ever have reached it.
 *
 * A code span CANNOT cross a paragraph break, so the scan unit is a maximal run
 * of non-blank lines. Blank lines still terminate a segment, which keeps the
 * fail-CLOSED direction (an unterminated opener consumes at most its own
 * paragraph, never the rest of the document) and keeps the bound linear — the
 * `suffMax` / cursor structure is unchanged, `\n` is simply an ordinary
 * character inside a segment.
 *
 * `PROTECTED_SPAN_RE` (the CARVE) is deliberately left per-line: it rounds the
 * other way, so at worst a multi-line code sample renders as escaped text.
 */
function findInlineCodeRanges(source: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  const len = source.length
  let pos = 0
  while (pos <= len) {
    // Grow one PARAGRAPH SEGMENT: the maximal run of non-blank lines starting
    // at or after `pos`. `segStart`/`segEnd` bound it; blank lines never enter.
    let segStart = -1
    let segEnd = -1
    while (pos <= len) {
      let end = source.indexOf('\n', pos)
      if (end === -1) end = len
      const blank = isBlankLine(source.slice(pos, end))
      if (blank && segStart !== -1) break
      if (!blank) {
        if (segStart === -1) segStart = pos
        segEnd = end
      }
      pos = end === len ? len + 1 : end + 1
    }
    if (segStart === -1) break
    const lineStart = segStart
    const lineEnd = segEnd
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
 * All of the blanking passes below share one contract:
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
 *
 * ---------------------------------------------------------------------------
 * THE SAFETY CLAIM IS LINE COVERAGE, NOT PASS COMPOSITION (round 18)
 * ---------------------------------------------------------------------------
 * Round 17 claimed this class was "closed by proof" and offered a PASS CALL
 * MATRIX — which pass invokes which — as the proof. That was the wrong
 * property, and round 18 found the eighth instance anyway. The matrix shows the
 * passes COMPOSE SYMMETRICALLY; it says nothing about whether every line of the
 * document is actually EXAMINED. Round 18's defect lived inside a pass that the
 * matrix lists as present and symmetric (`blankListItemCode` calls and is called
 * by `blankQuotedCode`): the pass simply never put the LIST-MARKER LINE into any
 * run, so that one line was examined by nobody. A symmetric call graph over an
 * incomplete line set is still incomplete. Do not restate the matrix as the
 * safety argument.
 *
 * ---------------------------------------------------------------------------
 * THE TABLE IS THE AUDITABLE ARTIFACT — AND TWO OF ITS ENTRIES WERE FALSE
 * ---------------------------------------------------------------------------
 * Round 19 audited the table below rather than the code, and found two entries
 * literally untrue. Both were LOAD-BEARING: the `blankListItemCode` entry
 * justified a `top >= 4` gate that hid three live instances (narrow `- ` / `1. `
 * marker lines), and the `blankLinkDefinitions` entry's "absorbs … ONE list
 * marker" justified never re-cutting nested markers. A table entry that is not
 * LITERALLY TRUE is worse than no table: it converts an unexamined line into a
 * documented decision. When you change a pass, restate what it NOW claims and
 * re-derive every other entry from the code — do not copy the previous wording
 * forward.
 *
 * THE INVARIANT THAT ACTUALLY MATTERS:
 *
 *   For every line L of the document and every block-level construct that can
 *   OPEN on L, some pass must examine L at L's own CONTENT COLUMN — the column
 *   at which CommonMark itself would begin parsing L, after every enclosing
 *   container prefix (blockquote markers, list-item content columns) has been
 *   consumed. "Examined" means the line is a member of that pass's scanned run,
 *   cut at that column; being merely SKIPPED OVER while state is updated does
 *   not count. Constructs that are not line-anchored at all (inline code spans,
 *   HTML comments, link reference definitions, inline link/image payloads) are
 *   covered instead by a CONTAINER-AGNOSTIC pass that runs once over the whole
 *   document.
 *
 *   AND: every region that CommonMark turns into an ATTRIBUTE OR AN IDENTIFIER
 *   rather than document text is a shelter of the same kind, whether or not it
 *   is line-anchored. A reference definition's destination/title and an INLINE
 *   link's destination/title are the same thing to remark — both become
 *   href/title and never appear as HTML — so both need a pass. Round 19 found
 *   the inline half entirely uncovered; it then implemented that generalization
 *   for only the PARENTHESISED half of the constructs the generalization names,
 *   and round 20 found the BRACKETED half — an image's alt, a reference label, a
 *   footnote label — uncovered in exactly the same way.
 *
 *   So the checklist for a newly supported construct is: which of its text does
 *   remark consume into an attribute or an identifier — INCLUDING bracket text
 *   under `!` and reference/footnote labels — rather than emit as document HTML?
 *   Every such region needs a pass. The complement matters just as much: text
 *   remark DOES emit (an inline link's `[…]`, a bare shortcut reference's
 *   `[…]`) must stay VISIBLE, because a closer written there is real.
 *
 *   AND: a length cap or a parse failure inside any of these passes must BLANK,
 *   never SKIP. `-1`-on-cap is the fail-OPEN shape `ba4a526b` closed for
 *   over-cap inline code spans and round 20 found reintroduced in
 *   `parseInlineLinkPayload` and the link-definition regexes. A cap is a
 *   BLANKING BOUNDARY: blank up to it. Only a genuinely unparseable SHAPE may
 *   decline, and only because remark will not read it as a link either.
 *
 *   THAT RULE WAS STATED AND NOT STRUCTURALLY ENFORCED, so every new parser
 *   re-litigated it and sometimes lost: `ba4a526b` (over-cap code spans), round
 *   20 (payload + definition CAPS), round 21 (the definition SHAPES the same
 *   round left behind). It is now enforced by SHAPE rather than by discipline —
 *   the three container-agnostic passes have exactly TWO stages, and the stage
 *   decides the fail direction:
 *
 *     RECOGNITION — "is this the construct at all?" MAY decline, and must,
 *     because every recognition decline is a spelling CommonMark ALSO refuses:
 *     remark emits the text as HTML, so a closer written in it is REAL and
 *     blanking it would over-escape a genuine element.
 *
 *     CONSUMPTION — "the construct was recognized" may NEVER decline. Every
 *     give-up routes through ONE channel per pass, whose DEFAULT is blanking to
 *     the construct's CommonMark bound (the next blank line):
 *     `blankInlineLinkPayloads` → `paragraphEnd`, `blankLinkDefinitions` →
 *     `blankLinesToParagraphBound`. A pass cannot "forget" to blank, because
 *     the give-up path IS the blanking path; there is no `return -1` reachable
 *     after commitment.
 *
 *   EXIT-PATH TABLE — every exit of the three passes, classified. Keep it
 *   accurate when you touch them; an unclassified exit is the next instance.
 *
 *   blankLinkDefinitions
 *     R  no `[` on the line / `LINK_DEF_OPEN_RE` fails  → not a definition line.
 *     R  `\[^` (GFM footnote), REFERENCED                → BLOCK-parsed body, may
 *                                                        hold real HTML (r19).
 *                                                        Only when the label is
 *                                                        REFERENCED: r22 found
 *                                                        the decline fail-OPEN
 *                                                        for the unreferenced
 *                                                        case, which
 *                                                        `blankUnreferencedFootnotes`
 *                                                        now blanks whole.
 *     R  `findLabelClose`: `]` not followed by `:`      → shortcut reference or
 *                                                        plain text; remark
 *                                                        EMITS it (the same
 *                                                        exclusion
 *                                                        `blankBracketLabels`
 *                                                        documents).
 *     R  `findLabelClose`: unescaped `[` in the label   → CommonMark rejects the
 *                                                        label → paragraph text.
 *     R  `findLabelClose`: paragraph bound, no `]:`     → an ordinary
 *                                                        `[`-leading prose
 *                                                        paragraph.
 *     R  `parseDestOnLine` -1 (angle dest unclosed)     → no line ending allowed
 *                                                        in `<…>`, and a bare
 *                                                        dest may not start with
 *                                                        `<` → not a definition.
 *     R  `parseDefTail`/`parseTitleTail` `decline`      → trailing content, or a
 *                                                        title neither
 *                                                        space-separated nor
 *                                                        delimiter-opened →
 *                                                        remark reads a
 *                                                        PARAGRAPH. On the
 *                                                        OPENER line this
 *                                                        unwinds the WHOLE
 *                                                        construct (nothing is
 *                                                        blanked). On a
 *                                                        CONTINUATION line it
 *                                                        splits in TWO, and the
 *                                                        old single sentence
 *                                                        was true of only one
 *                                                        (r22):
 *                                                          · after `needTitle`
 *                                                            the definition WAS
 *                                                            already complete
 *                                                            (a title is
 *                                                            optional), so
 *                                                            stopping is exact;
 *                                                          · after `needDest`
 *                                                            it was NOT — with
 *                                                            no parseable
 *                                                            destination remark
 *                                                            reads the whole run
 *                                                            as a PARAGRAPH —
 *                                                            and lines
 *                                                            `i..close.line`
 *                                                            are ALREADY blanked
 *                                                            by the committed
 *                                                            loop. So this exit
 *                                                            OVER-blanks the
 *                                                            label lines; safe
 *                                                            because
 *                                                            over-blanking only
 *                                                            hides closers.
 *     C  `openTitle` (title opens, never closes)        → BLANK to the paragraph
 *                                                        bound.
 *     C  end of `lines` / blank line while continuing   → everything up to the
 *                                                        bound is already
 *                                                        blanked.
 *     (no length cap exists in this pass at all)
 *
 *   blankInlineLinkPayloads / parseInlineLinkPayload
 *     C  `q >= limit`, input REMAINS past the cap       → returns `limit`, and
 *                                                        the caller widens to
 *                                                        `paragraphEnd` (r20).
 *     R  `q >= limit` because the INPUT IS EXHAUSTED    → returns -1. Nothing
 *                                                        closes the payload and
 *                                                        nothing will, so remark
 *                                                        reads text too. Split
 *                                                        out in r22: it used to
 *                                                        share the cap exit, so
 *                                                        the ordinary STREAMING
 *                                                        tail `see [a](/x`
 *                                                        blanked its paragraph
 *                                                        and flickered.
 *     R  angle dest not closed before `\n`/end          → CommonMark forbids a
 *                                                        line ending in `<…>`.
 *     R  bare dest with unbalanced `(`                  → not a link → text.
 *     R  no `)` where the payload must end              → not a link → text.
 *     -  `s[q] !== close` after the title loop          → UNREACHABLE: the loop
 *                                                        exits only on the
 *                                                        closer or on `q >=
 *                                                        limit`, and the latter
 *                                                        returns `overflow`
 *                                                        first.
 *
 *   blankBracketLabels
 *     R  no `[` in the document                         → no bracket construct.
 *     R  `]` with an empty stack                        → closes nothing.
 *     -  no length cap and no parse that can fail: the walk is total over the
 *        document and crosses newlines, so it has NO give-up path to classify.
 *
 * WHICH LINES EACH PASS CLAIMS, AND AT WHAT COLUMN:
 *
 *   findInlineCodeRanges  — EVERY line, at column 0 of its PARAGRAPH SEGMENT
 *     (a maximal run of non-blank lines). Container-agnostic: backtick runs are
 *     matched with no column or prefix anchoring, so a `> ` / indent prefix is
 *     ordinary text between ticks. Spans CROSS line breaks (round 18) and stop
 *     at a paragraph break, which is exactly CommonMark's bound.
 *   blankFencedRegions    — every line of the run it is GIVEN, at that run's
 *     column (the caller cut it). Absolute-column-limited by `FENCE_RE`'s 0..3
 *     indent cap, which is WHY the container passes must re-cut and re-run it.
 *   blankIndentedCode     — every line of the run it is given, at that run's
 *     column, with a list-content-column stack for the +4 threshold.
 *   blankLinkDefinitions  — EVERY line, in TWO dimensions that must both be
 *     stated, because round 21 found the entry true of the first and silently
 *     false of the second.
 *       COLUMN: at column 0 AND at the column its own prefix reaches.
 *       `LINK_DEF_CONTAINER_PREFIX` absorbs a blockquote run and AT MOST ONE
 *       list marker, so the top-level call covers a definition at nesting depth
 *       0 or 1 directly. DEEPER nesting (`- - [a]: …`) is NOT covered by the
 *       top-level call — round 19's corrected entry — and is reached only
 *       because both container passes re-run this pass on their stripped runs,
 *       and `blankListItemCode` re-cuts nested markers by recursing into
 *       ITSELF. That re-cut is load-bearing, not redundancy.
 *       SHAPE: what the label, destination and title may CONTAIN — the
 *       dimension the old wording never mentioned, so five ESCAPED-delimiter
 *       spellings and five MULTI-LINE spellings were "covered" by an entry that
 *       had not examined them. The pass is now a CHARACTER PARSER, not a line
 *       regex: `\` + one character is consumed as a unit EVERYWHERE (so a
 *       title may hold `\"` / `\'` / `\)` and a label `\]`), the LABEL may
 *       span lines up to the paragraph bound, and an unterminated TITLE is
 *       blanked to that same bound. There is no length cap of any kind. What it
 *       does NOT claim, and why, is on the exits themselves (see below).
 *   blankInlineLinkPayloads — EVERY inline link/image payload in the document,
 *     container-agnostic: the scan is anchored on the `](` bigram with no column
 *     or prefix anchoring, so a container prefix is ordinary text ahead of it.
 *     Claims ONLY the `(…)` payload — never the `[…]` text of an INLINE LINK,
 *     which is inline-parsed and reaches the document as HTML. Its cap
 *     (`INLINE_LINK_PAYLOAD_MAX`) BLANKS THROUGH rather than declining; only an
 *     unparseable SHAPE declines (round 20).
 *   blankBracketLabels     — EVERY `[…]` group in the document whose text remark
 *     consumes into an attribute or an identifier: an image's alt (`[` preceded
 *     by `!`), the second group of a `][` adjacency (a full reference's label),
 *     the first group of a `][]` adjacency (a collapsed reference's identifier),
 *     and a footnote label (`[^…]`, reference AND definition). Container-
 *     agnostic: one left-to-right bracket walk, no column or prefix anchoring.
 *     Claims NEITHER an inline link's `[…]` NOR a bare shortcut reference's —
 *     remark emits both as HTML, so a closer there is real (round 20).
 *   blankComments         — EVERY line, container-agnostic: `HTML_COMMENT_RE` is
 *     `[\s\S]`-based and anchored nowhere, so a comment matches straight through
 *     any prefix. Runs LAST, over the masked copy (see its docblock).
 *   blankQuotedCode       — supplies runs cut at the BLOCKQUOTE content column,
 *     for every maximal run of quote-prefixed lines, INCLUDING the line that
 *     opens the quote (the prefix regex matches it like any other).
 *   blankListItemCode     — supplies runs cut at the LIST-ITEM content column
 *     for EVERY line inside a list item at ANY content column >= 1 (round 19 —
 *     the gate used to be `>= 4` on the claim that "below column 4 the top-level
 *     passes already cover the line at the right column", which is true of a
 *     CONTINUATION line and FALSE of the MARKER line: at content column 2 or 3
 *     the marker line is examined only at column 0, where the leading `- ` /
 *     `1. ` is not whitespace and `FENCE_RE` cannot match). Includes THE MARKER
 *     LINE ITSELF (round 18) and re-cuts NESTED markers by recursing into itself
 *     (round 19), since `LIST_MARKER_RE` matches only the FIRST marker on a
 *     line.
 *
 * The two container passes call each other AND `blankListItemCode` calls itself,
 * and all of them call the fence + indented + link-definition passes, so a line
 * nested in any order and any DEPTH of containers is eventually cut to its own
 * content column. That composition is a MEANS to the invariant above, not a
 * substitute for it. When adding a pass or a container, the question to answer
 * is "which lines does it claim, at which column, and is any line now claimed by
 * nobody" — not "does the call graph look symmetric".
 */

/**
 * Length-preserving blank of MANY ranges in one pass. Ranges must be
 * non-overlapping and ascending.
 *
 * THE ONLY BLANKING PRIMITIVE (round 18 — performance). There used to be a
 * single-range `blankRange` beside it, and `blankIndentedCode` /
 * `blankFencedRegions` / `blankComments` each folded the document through it
 * ONCE PER LINE OR REGION. Every call rebuilds the entire string, so masking an
 * all-indented-code document was QUADRATIC — measured on
 * `__buildCloserHaystackForTest`: 37 KB → 6 ms, 151 KB → 178 ms, 389 KB →
 * 1127 ms, 989 KB → 3753 ms (2.5x input ⇒ ~6x time), and the two container
 * passes re-run both over every nested run, multiplying the constant. A ~400 KB
 * KB article or release-notes page — all of which go through this renderer —
 * blocked the main thread for over a second. Every pass now COLLECTS ranges and
 * applies them here exactly once, which is what the inline pass already did.
 * After, same four sizes and same harness: 2 ms / 5 ms / 12 ms / 28 ms — dead
 * linear at ~28 ns/char, a 134x improvement at 989 KB.
 *
 * Do not reintroduce a per-range helper; a pass that blanks in a loop is the
 * regression.
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
  const ranges: Array<[number, number]> = []
  let openStart: number | null = null
  let lastEnd = 0
  for (const line of lines) {
    const role = fences.push(line.content)
    lastEnd = line.contentStart + line.content.length
    if (role === 'open') openStart = line.start
    else if (role === 'close' && openStart !== null) {
      ranges.push([openStart, lastEnd])
      openStart = null
    }
  }
  if (openStart !== null) ranges.push([openStart, lastEnd])
  return blankRanges(masked, ranges)
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
  const ranges: Array<[number, number]> = []
  for (const line of lines) {
    // CommonMark's blank line (spaces/tabs, `\r`-tolerant), NOT `trim()` — see
    // `isBlankLine`. An NBSP-only line is CONTENT, and skipping it here as
    // "blank" is the same one-character reopening documented there.
    if (isBlankLine(line.content)) continue
    const indent = leadingIndent(line.content)
    const top = listContentCols.length ? listContentCols[listContentCols.length - 1] : 0
    if (indent >= top + 4) {
      ranges.push([line.contentStart, line.contentStart + line.content.length])
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
  return blankRanges(masked, ranges)
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
  const ranges: Array<[number, number]> = []
  let m: RegExpExecArray | null
  while ((m = HTML_COMMENT_RE.exec(source)) !== null) {
    ranges.push([m.index, m.index + m[0].length])
    if (m[0].length === 0) HTML_COMMENT_RE.lastIndex++
  }
  return blankRanges(masked, ranges)
}

/**
 * Blank LINK REFERENCE DEFINITIONS (round 18 — SECURITY).
 *
 * `remark` consumes a definition ENTIRELY and emits no node for it, so a
 * `</textarea>` written in a definition's DESTINATION or TITLE is never a real
 * closer — but it survived into the closer haystack, `hasLaterCloser` returned
 * true and a prose `<textarea>` above stayed LIVE. Reproduced byte-identical for
 * both `[a]: /x "</textarea>"` and `[a]: </textarea>`.
 *
 * FAIL DIRECTION: blank the WHOLE line on a definition-SHAPED match, without
 * modelling "a definition may not interrupt a paragraph". Over-blanking here can
 * only hide closers, i.e. escape MORE openers — the fail-CLOSED direction — so
 * the loose shape is the correct bias.
 *
 * MULTI-LINE SPELLINGS (round 19). CommonMark lets the destination AND/OR the
 * title sit on lines FOLLOWING the label. The previous continuation state was a
 * single `expectTitle` boolean checked against a BARE QUOTED TITLE, so
 * `[a]:\n/x "</textarea>"` blanked the `[a]:` line and left the whole
 * `destination + title` line visible (reproduced live, `escapeUnknownHtmlTags`
 * byte-identical); so did `[a]:\n</textarea>`. remark consumes the entire
 * definition and emits no link node at all, so the closer is fake in every one
 * of these spellings. The state is now a three-valued
 * `'none' | 'needDest' | 'needTitle'`:
 *
 *   - a definition line with NO destination     → `needDest`
 *   - a definition line with a destination but NO title → `needTitle`
 *   - `needDest` accepts a `destination [title]` line, then falls to
 *     `needTitle` (or `none` when that line carried the title)
 *   - `needTitle` accepts a bare quoted/parenthesised title line
 *
 * `needDest`'s continuation shape is deliberately loose (any single
 * non-whitespace run), which can over-blank ONE line after a bare `[a]:` — the
 * fail-CLOSED direction, and `[a]:` alone is not a shape prose produces.
 *
 * FOOTNOTES ARE EXCLUDED (round 19). `\[[^\]\n]{0,999}\]:` also matched a GFM
 * footnote definition `[^a]: …`, whose content is BLOCK-parsed and therefore
 * may contain REAL html: `[^a]: <textarea>hi</textarea>` rendered as escaped
 * visible source while the byte-identical pair in prose rendered correctly.
 * Cosmetic (fail-closed) rather than a security defect, but wrong, so the label
 * now rejects a leading `^`.
 *
 * CONTAINER-AGNOSTIC BY CONSTRUCTION, like `blankComments` — the shape absorbs
 * an optional blockquote run and one list marker, so a definition written inside
 * a quote or ON a list-marker line is covered by the SINGLE top-level call and
 * the pass never has to be threaded through the container recursion at a
 * container-relative column. The marker-line sweep dimension added in this round
 * found exactly that shape (`- [a]: /x "</textarea>"`) live.
 */
/**
 * The two `{0,16}` / `{1,16}` whitespace bounds here are the ONE cap in this
 * pass that may still decline a line, and it is unreachable as a fail-open: an
 * indent or a marker gap above 16 columns is also ≥ 4 columns past the
 * enclosing content column, so the line is INDENTED CODE and
 * `blankIndentedCode` has already blanked it. Verified live at gap 17
 * (`- ` + 16 spaces + `[a]: /x "</textarea>"` escapes correctly). Do not raise
 * them into an unbounded `*` on the assumption that "more is safer" — that
 * would let a 4-column-indented definition line escape the code path it
 * currently falls into.
 */
const LINK_DEF_CONTAINER_PREFIX = ' {0,3}(?:>[ \\t]?)*[ \\t]{0,16}(?:(?:[-*+]|\\d{1,9}[.)])[ \\t]{1,16})?'
/**
 * NO REGEX, AND NO LENGTH BOUND, ON LABEL / DESTINATION / TITLE
 * (round 20 removed the `{0,999}` caps; round 21 removed the regexes).
 *
 * Round 20 removed the counted caps because a regex that fails to match leaves
 * the line VISIBLE — the fail-OPEN direction this module's contract forbids.
 * It left the SHAPE of those regexes untouched, and the shape was
 * BACKSLASH-BLIND: `[^"\n]*` / `[^'\n]*` / `[^)\n]*` / `[^>\n]*` / `[^\]\n]*`
 * each stop at the FIRST delimiter, escaped or not, while CommonMark lets a
 * title hold `\"` / `\'` / `\)` and a label hold `\]`. The class stopped early,
 * the full-line anchor `[ \t]*\r?$` then failed, and the line stayed VISIBLE
 * while remark still consumed the definition and emitted NOTHING — five live
 * spellings, each `escapeUnknownHtmlTags(md) === md` with one live
 * `<textarea>`:
 *
 *   [a]: /x "a\"</textarea>"     [a]: /x 'it\'s </textarea>'
 *   [a]: /x (a\)</textarea>)     [a\]b]: /x "</textarea>"
 *   [a\]b]: </textarea>
 *
 * …while the unescaped CONTROL `[a]: /x "</textarea>"` blanked correctly, which
 * is what makes the escape (not the shape) the cause.
 *
 * AND THE LABEL AND TITLE MAY SPAN LINES. The old `'none' | 'needDest' |
 * 'needTitle'` state modelled continuation only AFTER the `]:`, so a LABEL that
 * opens on one line and closes on a later one, and a TITLE that opens
 * unterminated, were examined by NOBODY — `blankBracketLabels` deliberately
 * excludes a bare `[…]`, so the label had no other pass either. Live in both
 * renderers, byte-identical no-ops:
 *
 *   [foo\n</textarea>]: /x          [</textarea>\nfoo]: /x
 *   [foo\n</textarea>\nbar]: /x     > [foo\n> </textarea>]: /x
 *   [a]: /x "line1\n</textarea>"
 *
 * …plus the escalation: a live `<iframe src=… width=… height=…>` behind
 * `[foo\n</iframe>]: /x`.
 *
 * THE PASS IS THEREFORE A CHARACTER PARSER, NOT A LINE REGEX. It is
 * ESCAPE-AWARE by construction (`skipEscaped` consumes `\` + one character
 * everywhere), has no length cap at all, and is LINEAR: every scan helper below
 * advances its cursor monotonically over one line, and the outer line loop
 * telescopes (see `findLabelClose`'s `stoppedAt` contract). No nested
 * quantifier survives, so the backtracking risk the counted caps used to
 * pretend to bound is gone rather than re-bounded. MEASURED, not assumed —
 * `__buildCloserHaystackForTest`, median of 7, at 37/151/389/989 KB, before →
 * after: list-dense 3.1/7.9/20.6/47.8 → 2.8/7.5/19.1/54.8 ms; realistic
 * 1.9/5.8/15.4/43.9 → 1.6/5.8/16.3/49.9 ms; definition-dense 1.3/5.5/15.0/40.0
 * → 1.4/5.9/17.8/45.2 ms. Every series stays DEAD LINEAR (2.5x input ⇒ ~2.7x
 * time) and the ~13-15% constant is the price of a character parser over a
 * regex. The ESCAPED-definition corpus is the outlier at 25.1 → 51.2 ms,
 * because HEAD did NO WORK on it: the backslash-blind regex failed to match and
 * left the line visible, which is precisely the defect. Adversarial shapes
 * (`[` + 40 backslash pairs per line, an all-unclosed-label document) are the
 * FASTEST corpora measured — 9.5 ms and 14.3 ms at 989 KB — because
 * `findLabelClose`'s `stoppedAt` contract makes the outer loop telescope
 * instead of rescanning the paragraph once per line. Do not remove `stoppedAt`;
 * a naive per-line lookahead is quadratic on exactly those inputs.
 *
 * EXIT DISCIPLINE — the structural point of this round. The parse has exactly
 * two stages, and the stage decides the fail direction:
 *
 *   RECOGNITION (is this a definition at all?) may DECLINE. Every decline here
 *   is a shape CommonMark also refuses, so remark emits the text as HTML and a
 *   closer written in it is REAL — the same argument that keeps an inline
 *   link's `[…]` and a bare shortcut reference visible. Declining is the
 *   CORRECT answer, not a gap; the reachability argument for each is on the
 *   exit itself.
 *
 *   CONSUMPTION (a `[…]:` was recognized) may NEVER decline. Every give-up
 *   routes through `blankLinesToParagraphBound` — the ONE give-up channel —
 *   which blanks to the next blank line, CommonMark's own bound for a
 *   definition, exactly as `blankInlineLinkPayloads` widens a capped payload to
 *   `paragraphEnd`. A `decline` returned by the tail parser is a RECOGNITION
 *   verdict delivered late (the line is not definition-shaped after all), and
 *   it therefore unwinds the WHOLE construct — nothing is blanked — rather than
 *   leaving a half-blanked span behind.
 */

/** `\` consumes the next character. THE escape primitive for this pass — every
 *  scan below advances through it, which is what makes them all backslash-aware
 *  and all monotonic. */
function skipEscaped(s: string, i: number): number {
  return s[i] === '\\' ? i + 2 : i + 1
}

/** First UNESCAPED occurrence of `ch` in `s` at or after `at`, else -1. */
function findUnescaped(s: string, at: number, ch: string): number {
  for (let i = at; i < s.length; i = skipEscaped(s, i)) if (s[i] === ch) return i
  return -1
}

const isSpaceTab = (ch: string): boolean => ch === ' ' || ch === '\t'

function skipSpaces(s: string, i: number): number {
  while (i < s.length && isSpaceTab(s[i])) i++
  return i
}

/** Lines are `\n`-split, so a CRLF document leaves a trailing `\r`. The pass
 *  blanks WHOLE lines, so dropping it costs no offset accuracy. */
const stripCr = (s: string): string => (s.endsWith('\r') ? s.slice(0, -1) : s)

const TITLE_CLOSE: Record<string, string> = { '"': '"', "'": "'", '(': ')' }

/** Index just past a title whose opening delimiter is at `i`, or -1 when the
 *  title does not close on this line. CommonMark ALLOWS a title to span lines,
 *  so -1 is a CONTINUATION signal, never a decline. */
function parseTitleOnLine(s: string, i: number): number {
  const close = TITLE_CLOSE[s[i]]
  for (let q = i + 1; q < s.length; q = skipEscaped(s, q)) if (s[q] === close) return q + 1
  return -1
}

/** Index just past a destination at `i`, or -1.
 *
 *  RECOGNITION DECLINE (-1), reachability: only an angle destination that never
 *  closes on its line. CommonMark forbids a line ending inside `<…>` and a bare
 *  destination may not START with `<`, so such a line is not a definition to
 *  remark either — it is emitted as paragraph text and any closer in it is
 *  REAL. Blanking it would over-escape a genuine element. */
function parseDestOnLine(s: string, i: number): number {
  if (s[i] === '<') {
    for (let q = i + 1; q < s.length; q = skipEscaped(s, q)) if (s[q] === '>') return q + 1
    return -1
  }
  let q = i
  while (q < s.length && !isSpaceTab(s[q])) q = skipEscaped(s, q)
  return q > i ? Math.min(q, s.length) : -1
}

/** What the remainder of ONE line says about the definition being consumed. */
type DefTail =
  | { k: 'done' } // destination (+ optional title) complete; line ends
  | { k: 'needDest' } // nothing on this line; the destination follows
  | { k: 'needTitle' } // destination taken; a title MAY follow on a later line
  | { k: 'openTitle'; close: string } // a title opened here and did not close
  | { k: 'decline' } // not definition-shaped after all (see below)

/**
 * RECOGNITION DECLINE, reachability, for every `decline` this returns:
 *
 *  - trailing content after a COMPLETE destination (+ title): CommonMark reads
 *    a definition only when nothing but whitespace follows, so `[a]: /x junk
 *    </textarea>` is a PARAGRAPH to remark and its closer is REAL;
 *  - a title that is not space-separated from the destination (`[a]: <x>"t"`) —
 *    same, remark reads no title and the trailing text invalidates the line.
 *    The ANGLE spelling is the reachable one (round 22): `parseDestOnLine`
 *    consumes a BARE destination to the next space/tab, so in `[a]: /x"t"` the
 *    quote is part of the destination and the line returns `needTitle`, never
 *    this decline;
 *  - a non-delimiter where a title must begin — same;
 *  - an unclosed angle destination — see `parseDestOnLine`.
 *
 * In every case remark EMITS the text, so leaving it visible is required, not
 * merely permitted. This is the same boundary `blankBracketLabels` draws
 * around an inline link's `[…]`.
 */
function parseDefTail(c: string, at: number): DefTail {
  let q = skipSpaces(c, at)
  if (q >= c.length) return { k: 'needDest' }
  const destEnd = parseDestOnLine(c, q)
  if (destEnd < 0) return { k: 'decline' }
  q = destEnd
  const gap = skipSpaces(c, q)
  if (gap >= c.length) return { k: 'needTitle' }
  if (gap === q) return { k: 'decline' }
  return parseTitleTail(c, gap)
}

/** The title half of `parseDefTail`, also used for a BARE title continuation
 *  line. Same decline reachability. */
function parseTitleTail(c: string, q: number): DefTail {
  const close = TITLE_CLOSE[c[q]]
  if (!close) return { k: 'decline' }
  const end = parseTitleOnLine(c, q)
  if (end < 0) return { k: 'openTitle', close }
  return skipSpaces(c, end) >= c.length ? { k: 'done' } : { k: 'decline' }
}

/**
 * A definition's CONTINUATION lines carry the blockquote run and indent but
 * never a list marker — a marker would open a new item, not continue the
 * definition. The `{0,16}` indent bound is the same unreachable-as-fail-open
 * cap argued for `LINK_DEF_CONTAINER_PREFIX`: past 16 columns the line is ≥ 4
 * columns beyond the enclosing content column, i.e. INDENTED CODE that
 * `blankIndentedCode` has already blanked.
 */
const LINK_DEF_CONT_PREFIX_RE = / {0,3}(?:>[ \t]?)*[ \t]{0,16}/y
/** `\[(?!\^)` — a GFM FOOTNOTE definition is NOT a link reference definition;
 *  its content is block-parsed and may hold real HTML (round 19). */
const LINK_DEF_OPEN_RE = new RegExp(`^${LINK_DEF_CONTAINER_PREFIX}\\[(?!\\^)`)

function contPrefixLen(c: string): number {
  LINK_DEF_CONT_PREFIX_RE.lastIndex = 0
  return LINK_DEF_CONT_PREFIX_RE.exec(c)![0].length
}

/**
 * Walk forward for the `]:` that turns an opened label into a DEFINITION.
 * Crosses lines (a CommonMark label may), bounded by the next blank line.
 *
 * Returns `{ line, colon }` on success, or `{ stoppedAt }` — a RECOGNITION
 * decline whose reachability is:
 *   - a `]` not followed by `:` → a bare shortcut reference or ordinary text,
 *     which remark EMITS, so a closer inside it is real (the exclusion
 *     `blankBracketLabels` already documents);
 *   - an unescaped `[` inside the label → CommonMark rejects the label, so the
 *     whole run is paragraph text;
 *   - the paragraph bound with neither → an ordinary `[`-leading prose
 *     paragraph, which must stay untouched.
 *
 * `stoppedAt` also makes the outer loop LINEAR. Nothing in `[i, stoppedAt)`
 * holds a `]` or `[`, so no line in that window can open a definition either;
 * the caller resumes at `max(stoppedAt, i + 1)` and the per-line work
 * telescopes instead of rescanning the paragraph once per line.
 */
function findLabelClose(
  lines: MaskLine[],
  i: number,
  from: number,
): { line: number; colon: number } | { stoppedAt: number } {
  for (let j = i; j < lines.length; j++) {
    const c = stripCr(lines[j].content)
    if (j > i && isBlankLine(c)) return { stoppedAt: j }
    for (let q = j === i ? from : contPrefixLen(c); q < c.length; q = skipEscaped(c, q)) {
      if (c[q] === '[') return { stoppedAt: j }
      if (c[q] !== ']') continue
      return c[q + 1] === ':' ? { line: j, colon: q + 1 } : { stoppedAt: j }
    }
  }
  return { stoppedAt: lines.length }
}

/**
 * Blank LINK REFERENCE DEFINITIONS (round 18 — SECURITY).
 *
 * `remark` consumes a definition ENTIRELY and emits no node for it, so a
 * `</textarea>` written in a definition's LABEL, DESTINATION or TITLE is never
 * a real closer — but it survived into the closer haystack, `hasLaterCloser`
 * returned true and a prose `<textarea>` above stayed LIVE. Reproduced
 * byte-identical for `[a]: /x "</textarea>"`, `[a]: </textarea>`, the
 * multi-line spellings (round 19), the backslash-escaped delimiters and the
 * multi-line label/title (round 21).
 *
 * FAIL DIRECTION: blank the WHOLE line on a definition-SHAPED match, without
 * modelling "a definition may not interrupt a paragraph". Over-blanking here can
 * only hide closers, i.e. escape MORE openers — the fail-CLOSED direction — so
 * the loose shape is the correct bias.
 *
 * FOOTNOTES ARE EXCLUDED (round 19). The label rejects a leading `^`: a GFM
 * footnote definition's content is BLOCK-parsed and may contain REAL html.
 *
 * CONTAINER-AGNOSTIC BY CONSTRUCTION, like `blankComments` — the shape absorbs
 * an optional blockquote run and one list marker, so a definition written inside
 * a quote or ON a list-marker line is covered by the SINGLE top-level call.
 */
function blankLinkDefinitions(masked: string, lines: MaskLine[]): string {
  const ranges: Array<[number, number]> = []
  const blankLine = (line: MaskLine): void => {
    ranges.push([line.contentStart, line.contentStart + line.content.length])
  }

  /**
   * THE ONE GIVE-UP CHANNEL. A construct already recognized as a definition can
   * only ever stop blanking at CommonMark's own bound for it — the next blank
   * line — never by declining. Returns the index of the last line blanked.
   * `stop` lets a caller end EARLY on a line it recognises (a closing title
   * delimiter); returning false everywhere degrades to "blank to the bound",
   * which is the default this channel exists to guarantee.
   */
  const blankLinesToParagraphBound = (from: number, stop: (c: string) => boolean): number => {
    let k = from
    for (; k < lines.length; k++) {
      const c = stripCr(lines[k].content)
      if (isBlankLine(c)) break
      blankLine(lines[k])
      if (stop(c)) {
        k++
        break
      }
    }
    return k - 1
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.content.indexOf('[') === -1) {
      i++
      continue
    }
    const open = LINK_DEF_OPEN_RE.exec(line.content)
    if (!open) {
      i++
      continue
    }
    const close = findLabelClose(lines, i, open[0].length)
    if ('stoppedAt' in close) {
      i = Math.max(close.stoppedAt, i + 1)
      continue
    }
    const head = stripCr(lines[close.line].content)
    let tail = parseDefTail(head, close.colon + 1)
    // A late RECOGNITION verdict unwinds the WHOLE construct: remark emits every
    // line of it as text, so nothing may be blanked.
    if (tail.k === 'decline') {
      i = Math.max(close.line, i + 1)
      continue
    }
    // COMMITTED. From here every exit blanks.
    for (let j = i; j <= close.line; j++) blankLine(lines[j])
    let j = close.line
    while (tail.k !== 'done') {
      if (tail.k === 'openTitle') {
        const closer = tail.close
        j = blankLinesToParagraphBound(j + 1, (c) => findUnescaped(c, 0, closer) !== -1)
        break
      }
      const k = j + 1
      if (k >= lines.length) break
      const c = stripCr(lines[k].content)
      if (isBlankLine(c)) break
      const at = contPrefixLen(c)
      const next: DefTail =
        tail.k === 'needDest' ? parseDefTail(c, at) : parseTitleTail(c, skipSpaces(c, at))
      // The definition is already COMPLETE without this line (a destination-only
      // definition needs no title; a `[a]:` with no parseable destination is not
      // a definition at all and remark emits the following line as text), so this
      // is a RECOGNITION boundary, not a give-up.
      if (next.k === 'decline') break
      blankLine(lines[k])
      j = k
      tail = next
    }
    i = j + 1
  }
  return blankRanges(masked, mergeRanges(ranges))
}

/**
 * `[^` after the container prefix — a GFM FOOTNOTE definition opener, the shape
 * `LINK_DEF_OPEN_RE`'s `\[(?!\^)` deliberately refuses.
 *
 * The prefix absorbs a blockquote run and ANY NUMBER of list markers, where
 * `LINK_DEF_CONTAINER_PREFIX` stops at one. It has to: this pass is called ONCE
 * at top level (its reference set is document-global, so it cannot be re-run on
 * a container pass's stripped run the way `blankLinkDefinitions` is), and the
 * sweep found `- - [^zz]: … </textarea>` swallowing live at depth 2. Over-
 * detection is fail-CLOSED here — an unreferenced footnote is emitted by
 * nothing, so blanking more of one costs nothing at all.
 *
 * THE MARKER GROUP CARRIES NO LEADING WHITESPACE QUANTIFIER, deliberately. The
 * indent is matched ONCE before the group and afterwards only by each marker's
 * OWN trailing `[ \t]{1,16}`, so no two quantifiers ever compete for the same
 * whitespace run and a gap has exactly one viable split. The naive spelling
 * (`(?:[ \t]{0,16}marker[ \t]{1,16})*`) splits a 2-space gap two ways and
 * backtracks 2^depth on a NON-matching line — `-  -  -  …x` is ordinary prose.
 */
const FOOTNOTE_DEF_OPEN_RE = new RegExp(
  '^ {0,3}(?:>[ \\t]?)*[ \\t]{0,16}(?:(?:[-*+]|\\d{1,9}[.)])[ \\t]{1,16})*\\[\\^',
)
/** A blockquote run, WITHOUT swallowing the indent after it — the footnote-body
 *  continuation test has to MEASURE that indent, which `contPrefixLen` eats. */
const FOOTNOTE_QUOTE_PREFIX_RE = / {0,3}(?:>[ \t]?)*/y

/**
 * micromark's `normalizeIdentifier`, byte-for-byte: collapse every whitespace
 * run to one space, trim, then case-fold via `toLowerCase().toUpperCase()` (the
 * double fold is what makes ß/ẞ and the Turkish dotted I agree). A reference and
 * a definition are the SAME footnote exactly when these agree, so matching on
 * anything looser (raw slices) would call a resolved footnote unreferenced.
 */
function normalizeFootnoteLabel(label: string): string {
  return label
    .replace(/[\t\n\r ]+/g, ' ')
    .replace(/^ | $/g, '')
    .toLowerCase()
    .toUpperCase()
}

/** End index of the label opened by `[^` at `open`, i.e. the index of its
 *  closing `]`, or -1. Escape-aware and single-line, like the construct. An
 *  unescaped `[` inside voids the label exactly as it does for a link label. */
function footnoteLabelEnd(c: string, open: number): number {
  for (let q = open + 2; q < c.length; q = skipEscaped(c, q)) {
    if (c[q] === '[') return -1
    if (c[q] === ']') return q
  }
  return -1
}

/**
 * Blank UNREFERENCED GFM FOOTNOTE DEFINITIONS (round 22 — SECURITY).
 *
 * Round 19 excluded `[^label]:` from `blankLinkDefinitions` and wrote the
 * reason on the exit: a footnote's body is BLOCK-parsed and may hold REAL html,
 * so blanking it would hide a genuine closer and over-escape a genuine element.
 * That reason is true of a REFERENCED footnote and FALSE of an unreferenced one:
 * `remark-gfm` resolves definitions against references and DROPS a definition
 * nothing points at, emitting no node and no footnote section for it. Nothing in
 * its body reaches the document — but the whole line stayed live in the closer
 * haystack, `hasLaterCloser` returned true, and the prose opener above it was
 * left UNESCAPED. Reproduced end-to-end through the real
 * `escapeUnknownHtmlTags → remarkGfm → rehypeRaw → rehypeSanitize` chain:
 *
 *   Secret prose.
 *
 *   <iframe src="https://evil.example/x" width="600">
 *
 *   visible text
 *
 *   [^f]: note body </iframe>
 *
 * → `<p>Secret prose.</p><iframe src="https://evil.example/x" width="600">
 * visible text</iframe>` — a LIVE iframe keeping both attributes and swallowing
 * the prose below. Delete the footnote line and the same input escapes
 * correctly. The lesson the round generalises: a RECOGNITION decline's
 * justification must hold for EVERY sub-case of the construct, not the common
 * one.
 *
 * SO THE DECLINE IS NARROWED, NOT DROPPED. A definition whose label IS
 * referenced keeps round 19's treatment (untouched, body live). A definition
 * whose label is referenced NOWHERE is blanked with its body. That blanking is
 * EXACT, not merely fail-closed: remark emits NONE of those bytes.
 *
 * REFERENCE COLLECTION runs over the CURRENT MASK, not the raw source, so a
 * `[^f]` written inside code has already been blanked and cannot make a
 * definition look referenced. Counting FEWER references only blanks MORE, which
 * is the fail-CLOSED direction; counting a phantom one degrades to round 19's
 * behaviour, never worse. (Container-nested code is masked by passes that run
 * AFTER this one, so a reference inside such a region still counts — exactly
 * today's outcome for that shape, not a new hole.)
 *
 * BODY BOUND: the label line, its LAZY paragraph continuation lines, and any
 * further blocks indented >= 4 columns past the blockquote run — GFM's own
 * "content of a footnote is what an indented continuation would give a list
 * item". The walk stops at a de-indented line after a blank one, and at another
 * footnote-definition line, so a following REFERENCED footnote is not
 * over-blanked into escaped source.
 *
 * CONTAINER-AGNOSTIC BY CONSTRUCTION, and MORE so than `blankLinkDefinitions`:
 * the reference set is document-GLOBAL, so unlike that pass this one cannot be
 * re-run on a container pass's stripped run to reach deeper nesting. Its opener
 * prefix therefore absorbs any number of list markers itself (see
 * `FOOTNOTE_DEF_OPEN_RE`), and the single top-level call covers every depth.
 */
function blankUnreferencedFootnotes(masked: string, folded: MaskLine[]): string {
  // `[^` is rare and the whole pass is a no-op without one, so one native scan
  // buys the overwhelming majority of documents a total skip. This pass runs
  // over EVERY line of the document; without the guard and the `indexOf` walk
  // below it would be the most expensive one in the mask, for a construct
  // almost nothing contains (measured: no regression at 989 KB on a corpus with
  // no footnotes at all).
  if (masked.indexOf('[^') === -1) return masked
  // The MASK's text for a line, sliced on demand. `remapToMask` would allocate a
  // second object per line of the whole document for a pass that usually touches
  // one of them.
  const text = (line: MaskLine): string =>
    stripCr(masked.slice(line.contentStart, line.contentStart + line.content.length))

  // PASS 1 — every `[^label]` that is a REFERENCE. A group is a DEFINITION only
  // where the line-anchored opener shape puts it AND a `:` follows; every other
  // `[^…]`, including a mid-line `see [^f]: here`, is a reference to remark.
  // Occurrences are reached with `indexOf`, never a per-character walk: the pass
  // runs over EVERY line of the document and a char walk would make it the most
  // expensive one in the mask for a construct almost no line contains.
  const referenced = new Set<string>()
  const defAt: Array<number | null> = []
  for (const line of folded) {
    const c = text(line)
    let q = c.indexOf('[^')
    if (q === -1) {
      defAt.push(null)
      continue
    }
    const open = FOOTNOTE_DEF_OPEN_RE.exec(c)
    const defOpen = open ? open[0].length - 2 : -1
    let isDef: number | null = null
    for (; q !== -1; q = c.indexOf('[^', q)) {
      // Escape-aware without the walk: an ODD run of backslashes before the `[`
      // escapes it, an EVEN one is escaped backslashes and leaves `[` live.
      let back = q
      while (back > 0 && c[back - 1] === '\\') back--
      if ((q - back) % 2 === 1) {
        q += 2
        continue
      }
      const end = footnoteLabelEnd(c, q)
      if (end === -1) break
      if (q === defOpen && c[end + 1] === ':') isDef = q
      else referenced.add(normalizeFootnoteLabel(c.slice(q + 2, end)))
      q = end + 1
    }
    defAt.push(isDef)
  }

  // PASS 2 — blank each definition whose label nothing references, body included.
  const ranges: Array<[number, number]> = []
  for (let i = 0; i < folded.length; i++) {
    const at = defAt[i]
    if (at === null) continue
    const head = text(folded[i])
    const end = footnoteLabelEnd(head, at)
    if (referenced.has(normalizeFootnoteLabel(head.slice(at + 2, end)))) continue
    let j = i
    let sawBlank = false
    for (let k = i + 1; k < folded.length; k++) {
      const c = text(folded[k])
      if (isBlankLine(c)) {
        sawBlank = true
        continue
      }
      // A second definition ends this one; over-blanking a REFERENCED
      // neighbour's body would show it as escaped source (cosmetic, but avoidable).
      if (defAt[k] !== null) break
      // After a blank line only an INDENTED block continues the footnote; before
      // one, any non-blank line is a lazy paragraph continuation.
      if (sawBlank && footnoteIndentCols(c) < 4) break
      j = k
    }
    for (let k = i; k <= j; k++) {
      const line = folded[k]
      ranges.push([line.contentStart, line.contentStart + line.content.length])
    }
  }
  return blankRanges(masked, mergeRanges(ranges))
}

/** Leading indent of `c` in COLUMNS (tabs advance to the next multiple of 4)
 *  measured PAST the blockquote run, which is the column GFM measures a
 *  footnote's continuation blocks at. */
function footnoteIndentCols(c: string): number {
  FOOTNOTE_QUOTE_PREFIX_RE.lastIndex = 0
  let q = FOOTNOTE_QUOTE_PREFIX_RE.exec(c)![0].length
  let col = 0
  for (; q < c.length && isSpaceTab(c[q]); q++) col = c[q] === '\t' ? col + 4 - (col % 4) : col + 1
  return col
}

/**
 * Blank the PARENTHESISED PAYLOAD of an INLINE link or image (round 19 —
 * SECURITY, a whole shelter class the table did not name).
 *
 * remark consumes an inline link's DESTINATION and TITLE exactly as it consumes
 * a reference definition's: both become href/title ATTRIBUTES on the emitted
 * node and never reach the document as HTML. So a `</textarea>` written in
 * either one is not a closer — but `blankLinkDefinitions` only covers the
 * DEFINITION spelling, and no pass covered the inline one. All eight spellings
 * reproduced live (`escapeUnknownHtmlTags` byte-identical, one live
 * `<textarea>` swallowing the prose above it):
 *
 *   [a](/x "</textarea>")   [a](/x '</textarea>')   [a](/x (</textarea>))
 *   ![a](/x "</textarea>")  [a](</textarea>)        > [a](/x "</textarea>")
 *   - [a](/x "</textarea>") See [a](/x "</textarea>") for more.
 *
 * …and the escalation: an `<iframe src="…" width="600">` opener plus a title
 * shelter yields a LIVE iframe retaining both attributes.
 *
 * ONLY THE PAYLOAD IS BLANKED HERE, never the `[…]` text of an INLINE LINK
 * (`[text](dest)`). That text is INLINE-PARSED and reaches the document as
 * HTML, so blanking it would over-escape a paired `<textarea>…</textarea>`
 * written inside a link label. The bracket text of every OTHER spelling — an
 * IMAGE's alt, a reference LABEL, a footnote LABEL — is consumed into an
 * attribute or an identifier instead, and is blanked by `blankBracketLabels`
 * below. Round 20 found that half uncovered.
 *
 * CONTAINER-AGNOSTIC BY CONSTRUCTION, like `blankLinkDefinitions` and
 * `blankComments`: the scan is anchored on the `](` bigram with no column or
 * prefix anchoring, so a blockquote run or list marker is ordinary text ahead of
 * it and the single top-level call covers every container nesting.
 *
 * FAIL DIRECTION: blanks ONLY on a payload that parses through to its closing
 * `)`. A shape that does not parse is not a link to remark either, so its
 * `</textarea>` IS a real closer and must stay visible — declining to blank is
 * the correct answer there, not a gap. Conversely the parse is deliberately
 * LOOSER than CommonMark (it accepts payloads remark would reject, e.g. after a
 * `](`-shaped bigram in ordinary prose), and every such over-detection only
 * hides closers, i.e. escapes MORE openers.
 *
 * THE CAP IS A BLANKING BOUNDARY, NOT A REJECTION (round 20 — SECURITY).
 * `INLINE_LINK_PAYLOAD_MAX` bounds how far one `](` may blank, so a stray
 * bigram cannot blank an unbounded tail. It was originally spent as `return -1`
 * on every over-limit exit, which the caller reads as "not a link, leave
 * visible" — so `[a](/x "<1100 chars></textarea>")` sheltered its closer in
 * full view of the mask (`escapeUnknownHtmlTags` byte-identical, one live
 * RAWTEXT element; the `<iframe src=… width=…>` spelling kept both attributes).
 * CommonMark places NO length bound on a destination or a title, so that is
 * ordinary output, and this is the SAME fail-open shape `ba4a526b` closed for
 * over-cap inline code spans, reintroduced in newer code.
 *
 * A CAP-driven exit therefore returns `limit` — "blank through the cap" — while
 * a SHAPE-driven exit still returns -1. The two are distinguished by testing
 * `q >= limit` BEFORE the shape test at every exit; over-blanking a bounded
 * window is the fail-CLOSED direction, declining on a genuinely unparseable
 * shape is the deliberate one.
 *
 * AND THE CAP-DRIVEN EXIT MUST BLANK PAST THE CAP, not to it. Blanking exactly
 * `[from, limit)` still leaves the shelter live whenever the sheltered closer
 * sits BEYOND the cap — which is the ordinary case, since the filler is what
 * pushed the payload over it (measured: `[a](/x "<1100 y's></textarea>")` was
 * STILL a byte-identical no-op with a to-the-cap blank). So the caller widens a
 * capped payload to the end of its PARAGRAPH — CommonMark's own bound, since
 * neither a destination nor a title may contain a blank line. The cap therefore
 * only decides WHEN to stop parsing, never how little to blank, and a stray
 * `](` still cannot blank an unbounded tail: it fails on SHAPE and blanks
 * nothing.
 *
 * "FAILS ON SHAPE" HAS TO INCLUDE RUNNING OUT OF INPUT (round 22). It did not:
 * `limit` is `min(s.length, from + MAX)`, so a payload that simply reached the
 * END OF THE DOCUMENT hit the same `q >= limit` tests as a capped one and
 * returned `limit`, which the caller widened to `paragraphEnd`. `see [a](/x` at
 * end of input therefore blanked its paragraph tail (`see [a](  `) even though
 * nothing there is a link. Safe direction, but that is the COMMON shape while
 * STREAMING — the last token of a partial message is often a half-written link
 * — so an earlier opener was escaped mid-stream and unescaped when the link
 * completed, a visible flicker. The two are now distinguished by `overflow`:
 * `limit` only when input remains PAST the cap, -1 when the input is exhausted.
 * The cap path still blanks THROUGH (round 20's fix is untouched).
 */
const INLINE_LINK_PAYLOAD_MAX = 1024

const isInlineSpace = (ch: string): boolean =>
  ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v'

/** Index of the payload's closing `)`, or the cap index when the payload runs
 *  past `INLINE_LINK_PAYLOAD_MAX` (blank through the cap), or -1 when the shape
 *  does not parse. `from` is the index just past the `](`. */
function parseInlineLinkPayload(s: string, from: number): number {
  const limit = Math.min(s.length, from + INLINE_LINK_PAYLOAD_MAX)
  // What a `q >= limit` exit MEANS, which is not one thing (round 22):
  //  - the CAP truncated a payload that still has input after it → `limit`,
  //    "blank through the cap" (round 20; the caller widens to `paragraphEnd`);
  //  - the INPUT RAN OUT → -1, a SHAPE decline. Nothing closed the payload and
  //    nothing ever will in this document, so it is not a link to remark
  //    either. This is the ordinary STREAMING tail (`see [a](/x` as the last
  //    token), where returning `limit` widened the blank to the paragraph end
  //    and escaped an earlier opener that unescaped again once the link
  //    completed — a visible flicker.
  const overflow = limit < s.length ? limit : -1
  let q = from
  while (q < limit && isInlineSpace(s[q])) q++
  // DESTINATION — angle-bracketed, or a bare run with BALANCED parens.
  if (s[q] === '<') {
    q++
    while (q < limit && s[q] !== '>' && s[q] !== '\n') q += s[q] === '\\' ? 2 : 1
    if (q >= limit) return overflow
    if (s[q] !== '>') return -1
    q++
  } else {
    let depth = 0
    while (q < limit) {
      const ch = s[q]
      if (ch === '\\') {
        q += 2
        continue
      }
      if (isInlineSpace(ch)) break
      if (ch === '(') depth++
      else if (ch === ')') {
        if (depth === 0) break
        depth--
      }
      q++
    }
    if (q >= limit) return overflow
    if (depth !== 0) return -1
  }
  // TITLE — `"…"`, `'…'` or `(…)`, separated from the destination by space.
  const beforeGap = q
  while (q < limit && isInlineSpace(s[q])) q++
  const open = s[q]
  if (q > beforeGap && (open === '"' || open === "'" || open === '(')) {
    const close = open === '(' ? ')' : open
    let depth = 1
    q++
    while (q < limit) {
      const ch = s[q]
      if (ch === '\\') {
        q += 2
        continue
      }
      if (open === '(' && ch === '(') depth++
      else if (ch === close && --depth === 0) break
      q++
    }
    if (q >= limit) return overflow
    if (s[q] !== close) return -1
    q++
    while (q < limit && isInlineSpace(s[q])) q++
  }
  if (q >= limit) return overflow
  return s[q] === ')' ? q : -1
}

/** Start index of the first BLANK line at or after `from`, i.e. the end of the
 *  paragraph `from` sits in — the widest span an inline construct may cover. */
function paragraphEnd(s: string, from: number): number {
  let lineStart = s.indexOf('\n', from)
  while (lineStart !== -1) {
    lineStart += 1
    const next = s.indexOf('\n', lineStart)
    const line = s.slice(lineStart, next === -1 ? s.length : next)
    if (isBlankLine(line)) return lineStart
    if (next === -1) break
    lineStart = next
  }
  return s.length
}

function blankInlineLinkPayloads(masked: string, source: string): string {
  const ranges: Array<[number, number]> = []
  let i = source.indexOf('](')
  while (i !== -1) {
    const from = i + 2
    const cap = Math.min(source.length, from + INLINE_LINK_PAYLOAD_MAX)
    const close = parseInlineLinkPayload(source, from)
    if (close < 0) {
      i = source.indexOf('](', i + 1)
      continue
    }
    // A CAPPED payload (`close === cap`) has an unknown end, so blank to the end
    // of the paragraph — see the docblock. A parsed one blanks exactly.
    const end = close >= cap ? paragraphEnd(source, from) : close
    if (end > from) ranges.push([from, end])
    // Ascending and non-overlapping: resume past the range just blanked.
    i = source.indexOf('](', Math.max(end, from))
  }
  return blankRanges(masked, ranges)
}

/** Sort + merge so overlapping/nested finds satisfy `blankRanges`' contract
 *  (non-overlapping, ascending). Empty ranges are dropped. */
function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  ranges.sort((a, b) => a[0] - b[0])
  const out: Array<[number, number]> = []
  for (const [from, to] of ranges) {
    if (to <= from) continue
    const last = out[out.length - 1]
    if (last && from <= last[1]) {
      if (to > last[1]) last[1] = to
    } else out.push([from, to])
  }
  return out
}

/**
 * Blank the BRACKET TEXT of every spelling remark consumes into an ATTRIBUTE or
 * an IDENTIFIER (round 20 — SECURITY, the other half of the shelter class
 * `blankInlineLinkPayloads` opened).
 *
 * Round 19 wrote the general rule — "every region CommonMark turns into an
 * ATTRIBUTE rather than document text is a shelter of the same kind" — and then
 * implemented only the `(…)` payload half of it, on a rationale ("never the
 * `[…]` link TEXT, which is inline-parsed and may hold real HTML") that is true
 * of an INLINE LINK and false of every other bracket spelling. All seven
 * reproduced live, in BOTH renderers, with `escapeUnknownHtmlTags` returning the
 * input BYTE-IDENTICAL and a live RAWTEXT element swallowing the prose:
 *
 *   ![</textarea>](/x)        → alt="</textarea>"   (string attribute)
 *   ![</textarea>][r]         → alt="…"             (reference image)
 *   [a][</textarea>]          → label → identifier, never rendered
 *   [</textarea>][]           → collapsed reference, identifier again
 *   See[^</textarea>]         → href="#user-content-fn-%3C/textarea%3E"
 *   > ![</textarea>](/x)  ·  - ![</textarea>](/x)   (container-nested)
 *
 * …plus the escalation: `<iframe src="https://evil.example/x" width="600">` in
 * prose above `![</iframe>](/x)` yielded a LIVE iframe retaining `src`, `width`
 * and `height`.
 *
 * WHAT IS CLAIMED, AND WHAT IS DELIBERATELY NOT:
 *
 *   - a `[…]` whose `[` is immediately preceded by `!` — an image's alt is a
 *     STRING attribute in every image spelling (inline, reference, collapsed,
 *     shortcut), so the bracket text never reaches the document as HTML;
 *   - the SECOND `[…]` of a `][` adjacency — a FULL reference's label, which
 *     remark resolves to a definition and never renders;
 *   - the FIRST `[…]` of a `][]` adjacency — a COLLAPSED reference, whose
 *     bracket text IS the identifier. (remark also inline-parses it for display,
 *     so unlike an alt this one is not purely an attribute; blanking it is the
 *     fail-CLOSED direction and the reviewer-confirmed shelter, not a claim that
 *     the text is unrendered.)
 *   - a footnote LABEL, `[^…]`, in BOTH the reference and the definition —
 *     remark percent-encodes it into `href`/`id`. Only the LABEL: round 19 was
 *     right that a footnote definition's BODY is BLOCK-parsed and may hold real
 *     HTML, which is why `blankLinkDefinitions` refuses the whole line.
 *   - NOT the `[…]` of an inline `[text](…)` link, and NOT a bare SHORTCUT
 *     reference `[label]`: in both, remark emits the bracket text as inline
 *     HTML, so a `</textarea>` there IS a real closer and must stay visible.
 *     (Verified: with a live opener above it, that closer pairs.)
 *
 * The reference spellings are NOT reachable from the `](`-anchored scan in
 * `blankInlineLinkPayloads` — there is no `](` in `![x][r]` or `[a][r]` at all —
 * so this pass carries its own anchors.
 *
 * CONTAINER-AGNOSTIC BY CONSTRUCTION, like `blankInlineLinkPayloads`,
 * `blankLinkDefinitions` and `blankComments`: a single left-to-right bracket
 * walk with no column or prefix anchoring, so a blockquote run or list marker is
 * ordinary text ahead of it and ONE top-level call covers every nesting.
 *
 * FAIL DIRECTION: brackets that do not resolve to a link/image at all (ordinary
 * prose `see [1][2]`) are still blanked. Every such over-detection only hides
 * closers, i.e. escapes MORE openers. A backslash escape is consumed as a pair,
 * so `\[` does not open a group; `\!` still leaves the following `[` looking
 * image-like, which over-blanks in the same safe direction.
 */
function blankBracketLabels(masked: string, source: string): string {
  if (source.indexOf('[') === -1) return masked
  const ranges: Array<[number, number]> = []
  /** Open `[` positions, innermost last. */
  const open: number[] = []
  /** The most recently CLOSED group, for the `][` / `][]` adjacencies. */
  let prev: { open: number; close: number } | null = null
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '\\') {
      i++
      continue
    }
    if (ch === '[') {
      open.push(i)
      continue
    }
    if (ch !== ']') continue
    const from = open.pop()
    if (from === undefined) {
      prev = null
      continue
    }
    // IMAGE alt — `![…]`, every image spelling.
    if (from > 0 && source[from - 1] === '!') ranges.push([from + 1, i])
    // FOOTNOTE label — `[^…]`, reference and definition alike.
    if (source[from + 1] === '^') ranges.push([from + 2, i])
    // REFERENCE label — the second group of `[…][…]`, or, when that group is
    // EMPTY (`[…][]`), the first group, which is then the identifier.
    if (prev !== null && prev.close === from - 1) {
      if (i === from + 1) ranges.push([prev.open + 1, prev.close])
      else ranges.push([from + 1, i])
    }
    prev = { open: from, close: i }
  }
  return blankRanges(masked, mergeRanges(ranges))
}

/** `> ` / `>` container prefixes, including nested ones (`> > `). */
const BLOCKQUOTE_PREFIX_RE = /^(?: {0,3}>[ \t]?)+/

/**
 * EXACT NO-OP GUARDS for the container cross-calls (round 19 — performance).
 *
 * `blankQuotedCode` and `blankListItemCode` each call the other and
 * `blankListItemCode` now calls itself, and each of those calls walks the run
 * and folds the WHOLE document through `blankRanges` per flush. Widening the
 * list gate to `top >= 1` made every ordinary `- ` item open a run, so a
 * list-dense document paid that constant on every line (measured 3.1x at
 * 989 KB before these guards).
 *
 * Both guards are EXACT, not heuristic: `blankQuotedCode` only ever opens a run
 * on a line `BLOCKQUOTE_PREFIX_RE` matches and `blankListItemCode` only ever
 * pushes a column for a line `LIST_MARKER_RE` matches, so a run containing no
 * such line produces no runs at all and returns `masked` byte-identical. Skipping
 * a provable identity cannot change coverage — do NOT weaken either predicate
 * into an approximation of "probably nothing here"; that is how the eight
 * fail-open instances above were born.
 */
const hasListMarker = (line: MaskLine): boolean => LIST_MARKER_RE.test(line.content)
const hasQuotePrefix = (line: MaskLine): boolean => BLOCKQUOTE_PREFIX_RE.test(line.content)

/**
 * WINDOWED RUNS (round 19 — performance, and the same lesson as `blankRanges`
 * one level up).
 *
 * `blankRanges` is O(document): it rebuilds the whole string. The container
 * passes used to hand it the WHOLE document once per nested pass PER RUN, so a
 * document that is one long sequence of list/quote runs paid O(runs × document)
 * — a second quadratic, sitting directly above the one round 18 removed.
 * Widening the list gate to `top >= 1` tripled the run count and made it
 * visible: a 989 KB all-fenced-in-list-items document went 320 ms → 1006 ms.
 *
 * Runs are DISJOINT and ASCENDING, and every range any nested pass produces
 * lies inside its own run's span (fence ranges start at `line.start`, every
 * other pass at `line.contentStart`). So a run can be masked in ISOLATION, on a
 * window sliced out of the caller's baseline with all offsets rebased, and the
 * windows spliced back in ONE fold at the end. Same output, one document
 * rebuild per pass instead of one per run.
 *
 * Do not reintroduce a per-run fold; a container pass that reassigns the whole
 * `masked` inside its `flush` is the regression.
 */
function rebaseRun(run: MaskLine[], from: number): MaskLine[] {
  return run.map((line) => ({
    start: line.start - from,
    contentStart: line.contentStart - from,
    content: line.content,
  }))
}

function spliceWindows(masked: string, edits: Array<[number, number, string]>): string {
  if (edits.length === 0) return masked
  const parts: string[] = []
  let cursor = 0
  for (const [from, to, text] of edits) {
    if (from > cursor) parts.push(masked.slice(cursor, from))
    parts.push(text)
    cursor = to
  }
  parts.push(masked.slice(cursor))
  return parts.join('')
}

/** The window a run occupies: from the first line's START (fence ranges are
 *  anchored there, before any container prefix) to the last line's END. */
function runWindow(run: MaskLine[]): [number, number] {
  const last = run[run.length - 1]
  return [run[0].start, last.contentStart + last.content.length]
}

/**
 * CONTAINER NESTING DEPTH GUARD — and it FAILS CLOSED (round 19).
 *
 * The round-17 termination note claimed the mutual recursion was "verified
 * empirically on `> -   ` alternation nested 1/2/5/20/100/500/2000/8000 levels
 * deep … no throw, ≤4 ms, and the observed recursion depth CAPPED AT 4". THAT
 * CLAIM IS FALSE and was false when written: HEAD throws `RangeError: Maximum
 * call stack size exceeded` on that exact input from depth ~2000 up. The
 * recursion terminates (the measure argument is sound) but its DEPTH is bounded
 * only by input length, and V8's stack is not. A `RangeError` out of the
 * sanitizer is a rendering crash, i.e. a denial of service on a 24 KB message.
 *
 * Round 19's list self-recursion widened the trigger (a single line of `- `
 * markers overflows from depth ~4000, where HEAD survived because
 * `LIST_MARKER_RE` matches only the first marker), so the guard lands here.
 *
 * THE GUARD IS NOT A COVERAGE HOLE. At the limit the run is not skipped — it is
 * BLANKED WHOLE, which is the strictly more aggressive answer and exactly the
 * fail direction this module rounds towards everywhere else. A markdown document
 * nested 64 containers deep is a code sample rendered as escaped text, not a
 * shelter. Do NOT convert this into a `return` / `continue`: skipping is the
 * fail-OPEN direction and would be a new instance of the class.
 */
const CONTAINER_NEST_LIMIT = 64

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
 *
 * ---------------------------------------------------------------------------
 * MUTUAL RECURSION — TERMINATION (round 17)
 * ---------------------------------------------------------------------------
 * `blankQuotedCode` and `blankListItemCode` now call EACH OTHER (the missing
 * quote→list direction was the seventh instance of the fail-open class). The
 * recursion terminates on the measure `M(run) = Σ line.content.length`:
 *
 *  - `blankQuotedCode` only puts a line in a run when `BLOCKQUOTE_PREFIX_RE`
 *    matches, and that pattern is `(?: {0,3}>[ \t]?)+` — at least one `>`, so
 *    the stripped content is at least 1 char SHORTER. Blank lines never match
 *    (they carry no `>`), so EVERY line in a quoted run strictly shortens.
 *  - `blankListItemCode` only puts a line in a run when the content column
 *    `top >= 1` (round 19 — was `>= 4`), and `charIndexAtColumn(content, top)`
 *    with `top >= 1` returns an index `>= 1` (it can only return 0 when the
 *    requested column is 0), so that line strictly shortens too. ROUND-19
 *    RE-VERIFICATION: the same bound covers the new SELF-recursion — the run it
 *    hands itself is cut at the same `top >= 1`, so `M` strictly decreases
 *    across that call exactly as across the `blankQuotedCode` one. ROUND-18
 *    RE-VERIFICATION: this also
 *    covers the MARKER LINE, whose cut lands at `marker[0].length` (or
 *    `markerEnd + 1` under the clamp) — both `>= 2` for every marker spelling,
 *    so the bound `cut >= 1` is unchanged and the measure still strictly
 *    decreases. The reorder moved WHICH lines join a run, not the shortening
 *    property that makes the recursion finite. It also carries blank separators into an
 *    ALREADY-OPEN run as `content: ''` (length 0 ≤ original), and a run is only
 *    ever opened by a non-blank, strictly-shortened line.
 *
 * So each nested call is handed a run whose measure is strictly smaller than
 * the caller's, `M` is a non-negative integer, and the chain is finite.
 *
 * ---------------------------------------------------------------------------
 * FINITE IS NOT THE SAME AS SHALLOW (round 19 — the third false claim)
 * ---------------------------------------------------------------------------
 * Round 17 concluded here: "It is bounded by input length, so no depth guard is
 * added — there is no non-shortening case to guard against, and a speculative
 * bound would be a second, untested policy. Verified empirically on `> -   `
 * alternation nested 1/2/5/20/100/500/2000/8000 levels deep (240 KB source):
 * length invariant held, no throw, ≤4 ms, and the observed recursion depth
 * CAPPED AT 4 regardless of nesting."
 *
 * THE EMPIRICAL PART OF THAT IS FALSE, and was false when written. Re-run on the
 * described input, HEAD raises `RangeError: Maximum call stack size exceeded`
 * from depth ~2000 up — a 24 KB message crashes the renderer. The depth cap of 4
 * held only for the shapes round 17 happened to try; `BLOCKQUOTE_PREFIX_RE`
 * consumes a `> > >` nest in one match, but an ALTERNATING `> -   > -   …` line
 * gives each pass exactly one level to strip and the chain is as deep as the
 * line is long. Round 19's list self-recursion widened it further (a plain `- `
 * run overflows from ~4000, where HEAD survived only because `LIST_MARKER_RE`
 * matches the first marker alone).
 *
 * Termination was never the property at risk — STACK DEPTH was, and "bounded by
 * input length" is precisely the bound that does not help. `CONTAINER_NEST_LIMIT`
 * now caps it, blanking an over-deep run WHOLE rather than recursing, which is
 * fail-CLOSED and therefore not a coverage hole. Pinned by
 * `masks arbitrarily deep container nesting without throwing` at depths up to
 * 40000 (469 KB, 11 ms, closer masked at every depth).
 */
function blankQuotedCode(masked: string, lines: MaskLine[], depth = 0): string {
  let run: MaskLine[] = []
  // One edit per run, spliced in a SINGLE fold at the end — see `spliceWindows`.
  const edits: Array<[number, number, string]> = []
  const flush = () => {
    if (run.length === 0) return
    const [from, to] = runWindow(run)
    const wl = rebaseRun(run, from)
    let win = masked.slice(from, to)
    // Depth limit: blank the run WHOLE rather than recurse — see
    // `CONTAINER_NEST_LIMIT`. Fail-closed, never a skip.
    if (depth >= CONTAINER_NEST_LIMIT) {
      edits.push([from, to, blankRanges(win, [[0, win.length]])])
      run = []
      return
    }
    // The nested FENCE scan needs the unmasked `run` content (the inline-code
    // pass would have blinded it), but the nested INDENTED scan needs the CURRENT
    // mask — see `blankIndentedCode`'s SCAN-SOURCE INVERSION.
    const afterFences = blankFencedRegions(win, wl)
    win = blankIndentedCode(afterFences, remapToMask(afterFences, wl))
    win = blankLinkDefinitions(win, wl)
    // …and the LIST-container pass, mirroring the call `blankListItemCode`
    // already makes in the other direction. Without it a fenced sample inside a
    // LIST ITEM inside a QUOTE was seen by NO pass: `FENCE_RE` caps fence indent
    // at 3 ABSOLUTE columns, so at a quote-relative content column >= 4
    // (`> 1.  ` / `> -   ` / `> -\t`) the fence is invisible to the nested
    // tracker, and `blankIndentedCode`'s list-aware threshold (`contentCol + 4`)
    // starts at 8 and never reaches it either. Reproduced live for textarea and
    // iframe, at both list spellings, the tab spelling and depth-2 quotes;
    // `escapeUnknownHtmlTags` returned the input BYTE-IDENTICAL.
    if (wl.some(hasListMarker)) win = blankListItemCode(win, wl, depth + 1)
    edits.push([from, to, win])
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
  return spliceWindows(masked, edits)
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
function blankListItemCode(masked: string, lines: MaskLine[], depth = 0): string {
  const cols: number[] = []
  let run: MaskLine[] = []
  let runCol = 0
  // One edit per run, spliced in a SINGLE fold at the end — see `spliceWindows`.
  const edits: Array<[number, number, string]> = []
  const flush = () => {
    if (run.length === 0) return
    const [from, to] = runWindow(run)
    const wl = rebaseRun(run, from)
    let win = masked.slice(from, to)
    // Depth limit: blank the run WHOLE rather than recurse — see
    // `CONTAINER_NEST_LIMIT`. Fail-closed, never a skip.
    if (depth >= CONTAINER_NEST_LIMIT) {
      edits.push([from, to, blankRanges(win, [[0, win.length]])])
      run = []
      return
    }
    // The nested FENCE scan needs unmasked content; the nested INDENTED scan
    // needs the CURRENT mask — exactly `blankQuotedCode`'s split. The nested
    // QUOTED scan is needed too: `BLOCKQUOTE_PREFIX_RE` is anchored at columns
    // 0..3, so a quoted fence inside a column-4 item was missed by BOTH
    // containers' passes (`bq-in-col4-item`, reproduced live).
    const afterFences = blankFencedRegions(win, wl)
    win = blankIndentedCode(afterFences, remapToMask(afterFences, wl))
    win = blankLinkDefinitions(win, wl)
    if (wl.some(hasQuotePrefix)) win = blankQuotedCode(win, wl, depth + 1)
    // …and ITSELF, the symmetric counterpart of the `blankQuotedCode →
    // blankListItemCode` call above (round 19 — tenth instance of the fail-open
    // class). `LIST_MARKER_RE` is anchored at `^` and matches only the FIRST
    // marker on a line, so an INNER item's content column was never pushed and
    // a block opened on a nested marker line (`- - ```html`, `- - [a]: /x
    // "</textarea>"`) was cut to the OUTER item's column only — still short of
    // its own. Reproduced live for both shapes at zero quote depth
    // (`escapeUnknownHtmlTags` byte-identical, one live `<textarea>`, the
    // document below swallowed). Re-cutting the stripped run re-runs
    // `LIST_MARKER_RE` against content that now BEGINS at the outer item's
    // column, so the inner marker is the first one and its column is pushed.
    //
    // TERMINATION (self-recursion): every line put in a run is cut at
    // `charIndexAtColumn(content, top)` with `top >= 1`, which returns an index
    // `>= 1` (index 0 is only reachable for column 0), so EVERY member of the
    // run is strictly shorter than the line it came from. The measure
    // `M(run) = Σ line.content.length` from `blankQuotedCode`'s proof therefore
    // strictly decreases across this call exactly as it does across the
    // `blankQuotedCode` one — blank separators enter an already-open run as
    // `content: ''` (length 0 ≤ original) and never open one. `M` is a
    // non-negative integer, so the chain is finite; a run with no marker at all
    // pushes no column, leaves `top === 0`, opens no run and the recursion stops
    // one level down — which is exactly what `hasListMarker` short-circuits.
    if (wl.some(hasListMarker)) win = blankListItemCode(win, wl, depth + 1)
    edits.push([from, to, win])
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
    // THE MARKER LINE IS ITSELF ITEM CONTENT (round 18 — eighth instance of the
    // fail-open class). The marker used to be pushed AFTER the run-membership
    // decision, so `top` was read from the enclosing state and the marker line
    // NEVER entered a run — the run began on the line BELOW it. A block opened
    // ON the marker line (`-   ```html`, `1.  ```html`, `-\t```html`,
    // `> -   ```html`) was therefore seen by no pass at all: `FENCE_RE` caps
    // fence indent at 3 ABSOLUTE columns so the top-level tracker misses it, and
    // `blankIndentedCode`'s `contentCol + 4` threshold overshoots it. Worse, the
    // run then STARTED after the opener, so the item's CLOSING fence read as an
    // `open` to the nested tracker, which blanked to EOF while leaving the code
    // BODY — and its `</textarea>` — live in the haystack. Reproduced at ZERO
    // nesting depth (`escapeUnknownHtmlTags` returned the input BYTE-IDENTICAL,
    // one live editable `<textarea>` swallowing the prose above it), for both
    // textarea and iframe and at every marker spelling.
    //
    // Pushing the marker first makes `top` the column this line's own content
    // starts at, so `charIndexAtColumn(content, top)` cuts exactly at the marker
    // (`marker[0].length`, or `markerEnd + 1` under the clamp) and hands the
    // nested tracker precisely the item content.
    //
    // TERMINATION IS UNCHANGED: `top >= 4` still implies `cut >= 1` (the cut
    // index can only be 0 when the requested column is 0), so every line put in
    // a run still strictly shortens and the measure `M(run)` in
    // `blankQuotedCode`'s termination proof still strictly decreases.
    const marker = LIST_MARKER_RE.exec(line.content)
    if (marker) {
      const markerEndCol = visualColumn(line.content, marker[0].length - marker[2].length)
      const contentCol = visualColumn(line.content, marker[0].length)
      cols.push(contentCol - markerEndCol > 4 ? markerEndCol + 1 : contentCol)
    }
    const top = cols.length > 0 ? cols[cols.length - 1] : 0
    if (top !== runCol) {
      flush()
      runCol = top
    }
    // EVERY list item is re-scanned at its own content column (round 19 — ninth
    // instance of the fail-open class). The gate used to be `top >= 4`, on the
    // claim that "below column 4 the top-level passes already cover the line at
    // the right column". That is true for a CONTINUATION line — its absolute
    // indent of 2 or 3 falls inside `FENCE_RE`'s 0..3 cap — and FALSE for the
    // MARKER LINE, which the top-level passes examine only at column 0, where
    // the leading `- ` / `1. ` is not whitespace so `FENCE_RE` cannot match and
    // `blankIndentedCode`'s `contentCol + 4` overshoots. At content column 2 or
    // 3 — `- ` and `1. `, the two MOST COMMON spellings — the gate then denied
    // the marker line any run at all and no pass examined it. Reproduced live
    // for `- ```html` / `1. ```html` / the `<iframe>` spelling, EOF-terminated
    // (`escapeUnknownHtmlTags` byte-identical, one live RAWTEXT element, the
    // document below swallowed); the closed-fence spelling is rescued only
    // INCIDENTALLY by `findInlineCodeRanges` matching the two backtick runs.
    //
    // Round 18 fixed WHERE the column is pushed (the marker line now joins the
    // run) but kept a gate whose justification was untrue one column-range
    // lower. The gate was an unforced optimization: the pass is documented
    // monotonic, so re-scanning narrow items can only blank MORE, and
    // termination is unaffected (`top >= 1` still implies `cut >= 1`).
    if (top >= 1) {
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
  }
  flush()
  return spliceWindows(masked, edits)
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
  //    …and LINK REFERENCE DEFINITIONS, which remark consumes whole and emits
  //    nothing for, so a `</textarea>` in a destination or title is not a closer.
  masked = blankLinkDefinitions(masked, lines)
  //    …and the GFM FOOTNOTE definitions that pass deliberately refuses, but only
  //    the UNREFERENCED ones: remark-gfm drops those whole, so their bodies are
  //    not document text either. It reads the CURRENT mask (remapping its own
  //    lines, behind a `[^` guard) so a `[^f]` inside code cannot make a
  //    definition look referenced.
  masked = blankUnreferencedFootnotes(masked, lines)
  //    …and the INLINE link/image spelling of the same shelter, which remark
  //    likewise turns into href/title attributes. Container-agnostic, so like
  //    the definition pass it needs exactly one top-level call.
  masked = blankInlineLinkPayloads(masked, folded)
  //    …and the BRACKET half of that same class — an image's alt, a reference
  //    label, a footnote label — which remark consumes into an attribute or an
  //    identifier. Container-agnostic, so likewise exactly one top-level call.
  masked = blankBracketLabels(masked, folded)
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
