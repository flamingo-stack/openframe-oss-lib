import { describe, it, expect } from 'vitest'
import { resolveIcon, ICON_OPTIONS } from '../icon-library'
import { getIconComponent } from '../icon-registry'

/**
 * Proof that unifying the two resolvers into one variant-aware `resolveIcon`
 * does NOT change any glyph:
 *   - brand variant must be REFERENCE-IDENTICAL to the legacy `getIconComponent`
 *     (so every social / source-row consumer renders exactly the same icon).
 *   - design variant must resolve every curated picker name to a real component
 *     (no new FileIcon regressions), and never throw on null/unknown.
 */

// Names spanning BOTH consumer families, incl. the overlap set flagged in review
// (github/slack/clickup/hubspot) and the brand-color social names, plus PascalCase
// DB values that `getIconComponent` normalises.
const BRAND_NAMES = [
  'github', 'slack', 'clickup', 'hubspot', 'openframe',
  'linkedin', 'facebook', 'youtube', 'twitter', 'instagram', 'discord', 'rocket',
  // PascalCase social_platforms.icon_name values:
  'LinkedInIcon', 'XLogo', 'YouTubeIcon', 'Github',
  // unknown + nullish:
  'definitely-not-an-icon',
]

describe('unified resolveIcon — brand variant preserves getIconComponent exactly', () => {
  for (const name of BRAND_NAMES) {
    it(`brand('${name}') === getIconComponent('${name}')`, () => {
      expect(resolveIcon(name, { variant: 'brand' })).toBe(getIconComponent(name))
    })
  }

  it('null/undefined brand → same fallback as getIconComponent, no throw', () => {
    expect(resolveIcon(null, { variant: 'brand' })).toBe(getIconComponent(null))
    expect(resolveIcon(undefined, { variant: 'brand' })).toBe(getIconComponent(undefined))
  })
})

describe('unified resolveIcon — design variant (default) resolves every picker name', () => {
  it('every ICON_OPTIONS key resolves to a real component', () => {
    for (const opt of ICON_OPTIONS) {
      const Comp = resolveIcon(opt.key)
      expect(Comp, `design('${opt.key}') should resolve`).toBeDefined()
    }
  })

  it('null/unknown design → defined fallback, never throws', () => {
    expect(resolveIcon(null)).toBeDefined()
    expect(resolveIcon('definitely-not-an-icon')).toBeDefined()
  })
})
