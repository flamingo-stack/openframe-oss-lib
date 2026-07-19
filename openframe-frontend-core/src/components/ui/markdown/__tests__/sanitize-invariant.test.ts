/**
 * Coupled-allowlist invariant (unification plan §D1):
 * `effectivePrePassTags ⊆ effectiveSanitizerTags`, computed AFTER merging
 * `extraAllowedHtmlTags` into both — the text pre-pass must never admit a
 * raw tag rehype-sanitize then silently drops.
 */
import { describe, it, expect } from 'vitest'
import { buildEffectiveTagSet, buildSanitizeSchema, SAFE_HTML_TAGS } from '../sanitize'

function assertSubset(pre: Set<string>, schemaTags: string[]) {
  const sanitizerTags = new Set(schemaTags.map((t) => t.toLowerCase()))
  const missing = [...pre].filter((t) => !sanitizerTags.has(t))
  expect(missing, `pre-pass admits tags the sanitizer would drop: ${missing.join(', ')}`).toEqual([])
}

describe('coupled-allowlist invariant', () => {
  it('baseline: SAFE_HTML_TAGS ⊆ sanitizer tagNames', () => {
    assertSubset(buildEffectiveTagSet(), buildSanitizeSchema().tagNames)
  })

  it('with extraAllowedHtmlTags merged into BOTH lists (rich: video/source)', () => {
    const extra = ['video', 'source']
    assertSubset(
      buildEffectiveTagSet(extra),
      buildSanitizeSchema({ extraAllowedHtmlTags: extra }).tagNames,
    )
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
