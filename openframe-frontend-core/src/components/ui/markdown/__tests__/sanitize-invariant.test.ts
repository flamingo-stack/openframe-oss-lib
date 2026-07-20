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
import { buildEffectiveTagSet, buildSanitizeSchema, SAFE_HTML_TAGS, SVG_TAGS } from '../sanitize'

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
