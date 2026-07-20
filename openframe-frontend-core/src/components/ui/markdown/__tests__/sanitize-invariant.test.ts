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
    for (const required of ['cx', 'cy', 'r', 'stroke-width', 'strokeWidth']) {
      expect(circleAttrs, `circle must keep '${required}'`).toContain(required)
    }
  })

  it('input keeps the GFM tasklist contract (required is not contradicted)', () => {
    const schema = buildSanitizeSchema()
    const inputAttrs = (schema.attributes?.input ?? []).map((a) => (Array.isArray(a) ? a[0] : a))
    // `required.input` pins type=checkbox + disabled=true, so admitting
    // type/name/value/placeholder here would render authored text inputs as
    // disabled checkboxes. The widened attrs are deliberately NOT present.
    expect(schema.required?.input).toEqual({ type: 'checkbox', disabled: true })
    for (const forbidden of ['name', 'value', 'placeholder', 'readOnly']) {
      expect(inputAttrs, `input must NOT widen '${forbidden}'`).not.toContain(forbidden)
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
