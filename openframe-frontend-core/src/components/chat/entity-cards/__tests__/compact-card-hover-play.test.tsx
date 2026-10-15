/**
 * A compact card's play mark (`CardHoverPlay`) is drawn on hover only: it is
 * `group-hover`, so the card itself must be the `group`. Without it the mark on
 * a video cover never appears.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductReleaseCard } from '../../../shared/product-release/product-release-card';
import type { OnboardingGuide } from '../../types/entities/onboarding-guide';
import { OnboardingGuideCard } from '../onboarding-guide-card';

describe('a compact card is the group its hover play mark reads', () => {
  it('ProductReleaseCard sm', () => {
    render(
      <ProductReleaseCard
        size="sm"
        title="Agent 2.0"
        version="2.0.0"
        formattedDate="Oct 1, 2026"
        onClick={() => {}}
        coverImage="/thumb.png"
        hasVideoCover
      />,
    );
    expect(screen.getByRole('button')).toHaveClass('group');
  });

  it('OnboardingGuideCard sm', () => {
    const guide = {
      id: 'g1',
      title: 'Install the agent',
      slug: 'install-the-agent',
      section: 'Setup',
      step_order: 1,
      section_order: 1,
      content: null,
      video_summary: null,
      featured_image: null,
      main_video_thumbnail: '/thumb.png',
    } as unknown as OnboardingGuide;
    render(<OnboardingGuideCard guide={guide} href="/onboarding-guides/install-the-agent" size="sm" />);
    expect(screen.getByRole('link')).toHaveClass('group');
  });
});
