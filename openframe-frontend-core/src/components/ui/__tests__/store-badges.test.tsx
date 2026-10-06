import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppStoreBadge, GooglePlayBadge, StoreBadgeLinks } from '../store-badges';

const APP_STORE = 'https://apps.apple.com/us/app/openframe-console/id6801064262';
const GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=ai.openframe.mobile';

describe('StoreBadgeLinks', () => {
  /**
   * `noopener` is inert without a target, but `noreferrer` is not — and omitting it on
   * the same-window branch sent the embedding tenant's hostname to Apple and Google as a
   * Referer. So `rel` is unconditional and only `target` varies.
   */
  it('keeps rel on both branches and varies only the target', () => {
    const { rerender } = render(<StoreBadgeLinks appStoreUrl={APP_STORE} googlePlayUrl={GOOGLE_PLAY} />);
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('target', '_blank');
    }

    rerender(<StoreBadgeLinks appStoreUrl={APP_STORE} googlePlayUrl={GOOGLE_PLAY} openInNewTab={false} />);
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).not.toHaveAttribute('target');
    }
  });

  /** The anchors carry no label of their own; the name has to come from the artwork. */
  it('names each link from the badge it wraps', () => {
    render(<StoreBadgeLinks appStoreUrl={APP_STORE} googlePlayUrl={GOOGLE_PLAY} />);
    expect(screen.getByRole('link', { name: 'Download on the App Store' })).toHaveAttribute('href', APP_STORE);
    expect(screen.getByRole('link', { name: 'Get it on Google Play' })).toHaveAttribute('href', GOOGLE_PLAY);
  });

  /**
   * `GooglePlayBadge` paints through gradients and a clipPath, which are addressed by id.
   * Two rows on one page must not resolve each other's `<defs>`, so the ids are per
   * instance rather than per component.
   */
  it('gives every instance its own gradient and clipPath ids', () => {
    const { container } = render(
      <>
        <StoreBadgeLinks appStoreUrl={APP_STORE} googlePlayUrl={GOOGLE_PLAY} />
        <StoreBadgeLinks appStoreUrl={APP_STORE} googlePlayUrl={GOOGLE_PLAY} />
      </>,
    );

    const ids = [...container.querySelectorAll('[id]')].map(node => node.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);

    // And every `url(#…)` reference still resolves inside the tree that emitted it.
    // Read off the attributes rather than through a `[fill^=…]` selector: jsdom does not
    // match those against SVG attributes, so the selector form silently finds nothing.
    const refs = [...container.querySelectorAll('*')]
      .flatMap(node => [...node.attributes])
      .map(attr => attr.value)
      .filter(value => value.startsWith('url(#'))
      .map(value => value.slice(5, -1));
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ids).toContain(ref);
  });
});

describe('the badges on their own', () => {
  /** Vendor artwork: the caller sizes it, and nothing recolors it. */
  it('take a className without dropping their accessible name', () => {
    render(
      <>
        <AppStoreBadge className="h-8 w-auto" />
        <GooglePlayBadge className="h-8 w-auto" />
      </>,
    );
    const badges = screen.getAllByRole('img');
    expect(badges.map(badge => badge.getAttribute('aria-label'))).toEqual([
      'Download on the App Store',
      'Get it on Google Play',
    ]);
    for (const badge of badges) {
      expect(badge).toHaveClass('h-8', 'w-auto');
      expect(badge).not.toHaveAttribute('style');
    }
  });
});
