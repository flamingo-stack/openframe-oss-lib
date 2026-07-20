/**
 * Coupled-allowlist invariant (unification plan §D1), BOTH DIRECTIONS:
 * the effective pre-pass tag set and the effective sanitizer tag set are
 * EQUAL (case-insensitively), computed AFTER merging `extraAllowedHtmlTags`
 * into both.
 *   - pre-pass ⊆ sanitizer: the pre-pass must never admit a raw tag
 *     rehype-sanitize then silently drops.
 *   - sanitizer ⊆ pre-pass: the pre-pass must never ESCAPE a tag the
 *     sanitizer would keep (the direction that regressed `<strike>` and
 *     every other `defaultSchema`-only tag into visible source text).
 */
import { describe, it, expect } from 'vitest'
import { defaultSchema } from 'rehype-sanitize'
import {
  __buildCloserHaystackForTest,
  buildEffectiveTagSet,
  buildSanitizeSchema,
  escapeUnknownHtmlTags,
  SAFE_HTML_TAGS,
  SVG_TAGS,
} from '../sanitize'

function assertEqualSets(pre: Set<string>, schemaTags: string[]) {
  const sanitizerTags = new Set(schemaTags.map((t) => t.toLowerCase()))
  const escapedButKept = [...sanitizerTags].filter((t) => !pre.has(t))
  const admittedButDropped = [...pre].filter((t) => !sanitizerTags.has(t))
  expect(
    admittedButDropped,
    `pre-pass admits tags the sanitizer would drop: ${admittedButDropped.join(', ')}`,
  ).toEqual([])
  expect(
    escapedButKept,
    `pre-pass escapes tags the sanitizer would keep: ${escapedButKept.join(', ')}`,
  ).toEqual([])
}

describe('coupled-allowlist invariant', () => {
  it('baseline: pre-pass set === sanitizer tagNames (both directions)', () => {
    assertEqualSets(buildEffectiveTagSet(), buildSanitizeSchema().tagNames)
  })

  it('with extraAllowedHtmlTags merged into BOTH lists (rich: video/source)', () => {
    const extra = ['video', 'source']
    assertEqualSets(
      buildEffectiveTagSet(extra),
      buildSanitizeSchema({ extraAllowedHtmlTags: extra }).tagNames,
    )
  })

  it('every defaultSchema tag survives the pre-pass (strike regression)', () => {
    const pre = buildEffectiveTagSet()
    for (const tag of defaultSchema.tagNames ?? []) {
      expect(pre.has(tag.toLowerCase()), `pre-pass must not escape <${tag}>`).toBe(true)
    }
    expect(pre.has('strike')).toBe(true)
  })

  it('SVG elements are admitted by BOTH the pre-pass and the schema', () => {
    const pre = buildEffectiveTagSet()
    const schema = buildSanitizeSchema()
    for (const tag of SVG_TAGS) {
      expect(pre.has(tag.toLowerCase()), `pre-pass must admit <${tag}>`).toBe(true)
      expect(schema.tagNames, `schema must keep <${tag}>`).toContain(tag)
    }
  })

  it('SVG geometry/presentation attributes survive the schema', () => {
    const schema = buildSanitizeSchema()
    const svgAttrs = (schema.attributes?.svg ?? []).map((a) => (Array.isArray(a) ? a[0] : a))
    for (const required of ['viewBox', 'xmlns', 'fill']) {
      expect(svgAttrs, `svg must keep '${required}'`).toContain(required)
    }
    const circleAttrs = (schema.attributes?.circle ?? []).map((a) => (Array.isArray(a) ? a[0] : a))
    // Only the camelCase names are load-bearing: property-information
    // normalizes `stroke-width` → `strokeWidth` BEFORE the sanitizer runs, so
    // the dashed spellings never matched anything and are gone.
    for (const required of ['cx', 'cy', 'r', 'strokeWidth']) {
      expect(circleAttrs, `circle must keep '${required}'`).toContain(required)
    }
    expect(circleAttrs, 'dashed spellings are dead weight').not.toContain('stroke-width')
    // The exact hast spellings — a near-miss (`strokeDasharray`) fails
    // silently, so pin the ones real authored SVG uses.
    const textAttrs = (schema.attributes?.text ?? []).map((a) => (Array.isArray(a) ? a[0] : a))
    for (const required of ['fontSize', 'textAnchor', 'dominantBaseline', 'style']) {
      expect(textAttrs, `text must keep '${required}'`).toContain(required)
    }
    const rectAttrs = (schema.attributes?.rect ?? []).map((a) => (Array.isArray(a) ? a[0] : a))
    // `strokeDashArray` — capital A — is CORRECT and verified against the
    // installed `property-information`, which capitalizes the segment AFTER
    // `stroke-`:
    //   find(svg, 'stroke-dasharray')  -> 'strokeDashArray'
    //   find(svg, 'stroke-dashoffset') -> 'strokeDashOffset'
    //   find(svg, 'stroke-miterlimit') -> 'strokeMiterLimit'
    // It does NOT follow the DOM/React `strokeDasharray` spelling. Reviewers
    // (human and bot) keep "fixing" this to `strokeDasharray`, which would
    // INTRODUCE the silent near-miss this assertion exists to catch.
    for (const required of ['strokeDashArray', 'fillOpacity', 'style']) {
      expect(rectAttrs, `rect must keep '${required}'`).toContain(required)
    }
  })

  it('SVG-only tags are pinned to an svg ancestor (bare <title> cannot hijack)', () => {
    const schema = buildSanitizeSchema()
    // `title`/`desc`/`text`/`g`/… are ALSO HTML element names. Unconstrained,
    // a bare `<title>` in a post or a chat message is hoisted into <head> by
    // React 19 (tab + SEO title hijack) and swallows the rest of the document
    // via its RAWTEXT content model.
    for (const tag of ['title', 'desc', 'text', 'g', 'line', 'use', 'symbol', 'marker', 'mask', 'pattern']) {
      expect(schema.ancestors?.[tag], `<${tag}> must require an svg ancestor`).toEqual(['svg'])
    }
    expect(schema.ancestors?.tspan).toEqual(['svg', 'text'])
    // defaultSchema's own table constraints must survive the merge.
    expect(schema.ancestors?.tbody).toEqual(defaultSchema.ancestors?.tbody)
  })

  it('input carries the GFM tasklist contract WITHOUT coercing authored inputs', () => {
    const schema = buildSanitizeSchema()
    const inputAttrs = schema.attributes?.input ?? []
    const names = inputAttrs.map((a) => (Array.isArray(a) ? a[0] : a))
    // `required.input` is cleared: defaultSchema force-ADDS
    // `type=checkbox disabled` to EVERY input regardless of its attributes,
    // so an authored `<input type="text">` came out a disabled checkbox.
    expect(schema.required?.input).toBeUndefined()
    // The contract now lives in the attribute allowlist: `type` is pinned to
    // the literal `checkbox`, so a text input degrades to a bare `<input>`.
    expect(inputAttrs).toContainEqual(['type', 'checkbox'])
    expect(names).toContain('checked')
    expect(names).toContain('disabled')
    for (const forbidden of ['name', 'value', 'placeholder', 'readOnly']) {
      expect(names, `input must NOT widen '${forbidden}'`).not.toContain(forbidden)
    }
  })

  it('legacy presentational tags survive (center/font/big regression)', () => {
    const pre = buildEffectiveTagSet()
    const schema = buildSanitizeSchema()
    for (const tag of ['center', 'font', 'big', 'strike', 'tt']) {
      expect(pre.has(tag), `pre-pass must not escape <${tag}>`).toBe(true)
      expect(schema.tagNames, `schema must keep <${tag}>`).toContain(tag)
    }
    const fontAttrs = (schema.attributes?.font ?? []).map((a) => (Array.isArray(a) ? a[0] : a))
    for (const required of ['color', 'size', 'face']) {
      expect(fontAttrs, `font must keep '${required}'`).toContain(required)
    }
  })

  it('video keeps its source attributes through the schema (attribute survival)', () => {
    const schema = buildSanitizeSchema({ extraAllowedHtmlTags: ['video', 'source'] })
    const videoAttrs = (schema.attributes?.video ?? []).map((a) =>
      Array.isArray(a) ? a[0] : a,
    )
    for (const required of ['src', 'poster', 'controls']) {
      expect(videoAttrs, `video must keep '${required}'`).toContain(required)
    }
    const sourceAttrs = (schema.attributes?.source ?? []).map((a) =>
      Array.isArray(a) ? a[0] : a,
    )
    expect(sourceAttrs).toContain('src')
  })

  it('id clobbering is disabled (raw-HTML #anchor deep-links survive)', () => {
    const schema = buildSanitizeSchema()
    expect(schema.clobber).toEqual([])
    expect(schema.clobberPrefix).toBe('')
  })

  it('card/mention protocols are registered for href', () => {
    const schema = buildSanitizeSchema()
    expect(schema.protocols?.href).toContain('card')
    expect(schema.protocols?.href).toContain('mention')
  })

  it('SAFE_HTML_TAGS still excludes video (chat baseline)', () => {
    expect(SAFE_HTML_TAGS.has('video')).toBe(false)
  })
})

/**
 * ROUND-21 — the LINK REFERENCE DEFINITION spellings, pinned HERE rather than
 * only in the parity corpus, exactly as the round-19/20 payload spellings are.
 *
 * A definition is consumed ENTIRELY by remark, which emits no node for it, so a
 * `</textarea>` in its LABEL, DESTINATION or TITLE is never a real closer. The
 * pass that blanks them used to be a set of line REGEXES, and a regex that fails
 * to match leaves the line VISIBLE — the fail-OPEN direction. Two shape
 * dimensions were never examined:
 *
 *   ESCAPED DELIMITERS — `[^"\n]*` / `[^'\n]*` / `[^)\n]*` / `[^\]\n]*` stop at
 *   the first delimiter, escaped or not, while CommonMark permits `\"`, `\'`,
 *   `\)` and `\]` inside them.
 *
 *   MULTI-LINE LABEL / TITLE — the continuation state modelled only what comes
 *   AFTER the `]:`, and `blankBracketLabels` deliberately excludes a bare `[…]`,
 *   so a label spanning lines had no pass at all.
 *
 * Every row below was a byte-identical no-op with one live RAWTEXT element.
 * These assert on the MASK directly (no renderer), so a regression is pinned at
 * the pass rather than at a rendered snapshot.
 */
describe('link-definition shelters blank in every shape (round 21)', () => {
  const PRE = 'The <textarea> element explained.\n\n'
  const TAIL = '\n\n## After heading\n\nsecret tail\n'

  it.each([
    // The unescaped CONTROL — already correct before round 21, which is what
    // makes the ESCAPE (not the shape) the cause of the rows below it.
    ['control: unescaped title', '[a]: /x "</textarea>"'],
    ['escaped double quote in title', '[a]: /x "a\\"</textarea>"'],
    ["escaped apostrophe in title", "[a]: /x 'it\\'s </textarea>'"],
    ['escaped paren in title', '[a]: /x (a\\)</textarea>)'],
    ['escaped bracket in label, title shelter', '[a\\]b]: /x "</textarea>"'],
    ['escaped bracket in label, destination shelter', '[a\\]b]: </textarea>'],
    ['multi-line label', '[foo\n</textarea>]: /x'],
    ['multi-line label, closer on the FIRST line', '[</textarea>\nfoo]: /x'],
    ['three-line label', '[foo\n</textarea>\nbar]: /x'],
    ['blockquoted multi-line label', '> [foo\n> </textarea>]: /x'],
    ['multi-line title', '[a]: /x "line1\n</textarea>"'],
  ])('blanks the sheltered closer: %s', (_label, body) => {
    const md = PRE + body + TAIL
    const masked = __buildCloserHaystackForTest(md)
    // The mask is LENGTH-PRESERVING, and the fake closer is gone from it…
    expect(masked.length).toBe(md.length)
    expect(masked).not.toContain('</textarea>')
    // …so the prose opener above it is escaped rather than left live.
    expect(escapeUnknownHtmlTags(md)).toContain('&lt;textarea&gt;')
  })

  /**
   * THE RECOGNITION BOUNDARY, the complement that keeps the widened parser from
   * eating prose. In each of these remark EMITS the text, so the closer is REAL
   * and must stay VISIBLE in the haystack.
   */
  it.each([
    ['no `]:` arrives in the paragraph', 'The <textarea> element.\n\n[foo\n</textarea> bar\n'],
    ['`]` not followed by `:`', 'The <textarea> element.\n\n[foo\n</textarea>] bar\n'],
    ['unescaped `[` inside the label', 'The <textarea> element.\n\n[foo[bar\n</textarea>]: /x\n'],
    ['trailing content after a title', 'The <textarea> element.\n\n[a]: /x "t" </textarea>\n'],
    ['trailing content after a destination', 'The <textarea> element.\n\n[a]: /x </textarea>\n'],
    ['continuation line that is not a title', 'The <textarea> element.\n\n[a]: /x\n</textarea> is real\n'],
    ['GFM footnote definition (block-parsed body)', 'Body[^a].\n\n[^a]: <textarea>hi</textarea>\n'],
  ])('leaves a NON-definition visible: %s', (_label, md) => {
    const masked = __buildCloserHaystackForTest(md)
    expect(masked.length).toBe(md.length)
    expect(masked).toContain('</textarea>')
  })

  /**
   * THE CONSUMPTION SIDE: a title that opens and never closes is BLANKED to the
   * paragraph bound, never declined — and the blanking STOPS at that bound, so
   * the pass cannot run away down the document.
   */
  it('blanks an unterminated title to the paragraph bound, and no further', () => {
    const md =
      'The <textarea> element explained.\n\n[a]: /x "never closes\n</textarea>\nstill inside\n\n## After heading\n'
    const masked = __buildCloserHaystackForTest(md)
    expect(masked.length).toBe(md.length)
    expect(masked).not.toContain('</textarea>')
    // The haystack is case-folded; the heading past the bound is untouched.
    expect(masked).toContain('## after heading')
  })
})
