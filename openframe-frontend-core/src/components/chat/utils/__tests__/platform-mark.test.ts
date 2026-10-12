import { describe, expect, it } from 'vitest';
import { PLATFORM_DOMAINS } from '../../../../platform-domains';
import { platformMarkRef } from '../icon-loading';

/** Every platform the registry knows, minus the pseudo entries that are not platforms. */
const PLATFORMS = PLATFORM_DOMAINS.filter(entry => !entry.pseudo).map(entry => entry.key);

describe('platform marks, by convention', () => {
  it('draws a platform with its own `<name>-mark`, else its `<name>-logo`', () => {
    expect(platformMarkRef('flamingo')).toEqual({ set: 'FlamingoMarkIcon' });
    expect(platformMarkRef('tmcg')).toEqual({ set: 'TmcgMarkIcon' });
    expect(platformMarkRef('openmsp')).toEqual({ set: 'OpenmspLogoIcon' });
    expect(platformMarkRef('openframe')).toEqual({ set: 'OpenframeLogoIcon' });
    expect(platformMarkRef('mlg')).toEqual({ set: 'MlgLogoIcon' });
  });

  it('draws a platform with no mark of its own with the house mark, in its own accent', () => {
    for (const hub of PLATFORMS.filter(name => name.endsWith('-hub'))) {
      expect(platformMarkRef(hub)).toEqual({ set: 'FlamingoMarkIcon', color: 'var(--color-accent-primary)' });
    }
    expect(platformMarkRef('a-platform-added-tomorrow').set).toBe('FlamingoMarkIcon');
  });

  it('draws the "every platform" scope as a globe', () => {
    expect(platformMarkRef('universal')).toEqual({ lucide: 'globe' });
  });

  it('gives every registered platform a mark', () => {
    for (const platform of PLATFORMS) {
      const mark = platformMarkRef(platform);
      expect(mark.set ?? mark.lucide, platform).toBeTruthy();
    }
  });
});
