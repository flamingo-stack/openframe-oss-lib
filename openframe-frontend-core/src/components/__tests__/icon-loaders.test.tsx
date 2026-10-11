import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { listGeneratedIcons, renderIconLoaders } from '../../../scripts/generate-icon-loaders.mjs';
import { AVAILABLE_SVG_ICONS } from '../../types/announcement';
import { findIcon, ICON_OPTIONS, resolveIcon } from '../chat/utils/icon-library';
import { normalizeIconKey, registryIcon } from '../chat/utils/icon-registry';
import { ICON_LOADERS } from '../icons-v2-generated/icon-loaders';

/**
 * The name-to-icon resolver loads an icon's own module on demand through
 * `ICON_LOADERS`. These hold the table to the set it is generated from, and the
 * resolver to what it drew when it imported the whole set.
 */
describe('the icon loader table', () => {
  it('is what the generator writes from the set today', () => {
    const committed = readFileSync(join(__dirname, '../icons-v2-generated/icon-loaders.ts'), 'utf8');
    expect(committed).toBe(renderIconLoaders(listGeneratedIcons()));
  });

  it('names every icon the set exports, and nothing else', async () => {
    const set: Record<string, unknown> = await import('../icons-v2-generated');
    const exported = Object.keys(set)
      .filter(name => /^[A-Z][A-Za-z0-9]*Icon$/.test(name))
      .sort();
    expect(Object.keys(ICON_LOADERS).sort()).toEqual(exported);
    // The whole set is imported here (about 1,800 modules): slow when the suite runs in parallel.
  }, 30_000);

  it('loads the icon the set exports under that name', async () => {
    const set: Record<string, unknown> = await import('../icons-v2-generated');
    for (const name of ['Rocket02Icon', 'DotsLoaderIcon', 'BrainAIIcon', 'AnthropicLogoIcon']) {
      const loaded = await ICON_LOADERS[name]();
      expect(loaded.default, name).toBe(set[name]);
    }
  });
});

describe('an icon resolved by name from the set', () => {
  it('is the same component every time it is asked for', () => {
    expect(resolveIcon('chart-pie')).toBe(resolveIcon('chart-pie'));
    expect(findIcon('chart-pie')).toBe(resolveIcon('chart-pie'));
  });

  it('draws the icon once its module has loaded, with the props it was given', async () => {
    render(createElement(resolveIcon('chart-pie'), { size: 20, className: 'probe', 'data-testid': 'icon' } as never));
    const icon = await screen.findByTestId('icon');
    expect(icon.tagName.toLowerCase()).toBe('svg');
    expect(icon.getAttribute('class')).toContain('probe');
    expect(icon.getAttribute('width')).toBe('20');
  });

  it('is found for every name the admin picker offers', () => {
    for (const option of ICON_OPTIONS) expect(findIcon(option.key), option.key).not.toBeNull();
  });

  it('is found for every name the announcement picker offers', () => {
    for (const option of AVAILABLE_SVG_ICONS) expect(findIcon(option.name), option.name).not.toBeNull();
  });

  it('draws a lucide icon for a stored name the set does not hold, never the file glyph', () => {
    expect(findIcon('git-pull-request')).toBeNull();
    expect(resolveIcon('git-pull-request')).not.toBe(resolveIcon('definitely-not-an-icon'));
  });

  it('resolves the names `social_platforms.icon_name` stores', () => {
    const stored = [
      'FacebookIcon',
      'FileText',
      'Github',
      'Globe',
      'InstagramIcon',
      'LinkedInIcon',
      'Mail',
      'MessageCircle',
      'Send',
      'SlackIcon',
      'Video',
      'WhatsAppIcon',
      'XLogo',
      'YouTubeIcon',
    ];
    for (const name of stored) expect(registryIcon(normalizeIconKey(name)), name).toBeDefined();
  });

  it('is not found for a name the set does not hold', () => {
    expect(findIcon('definitely-not-an-icon')).toBeNull();
  });
});
