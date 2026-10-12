/**
 * `CaseStudyCard`: only the `result` density shows a metric; the regular
 * densities never change their box for one.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CaseStudyCardData } from '../../../../types/case-study';
import { CaseStudyCard, CaseStudyCardSkeleton } from '../case-study-card';

const base: CaseStudyCardData = { id: 1, title: 'How Acme cut ticket time', summary: null, featured_image: null };
const withMetrics: CaseStudyCardData = {
  ...base,
  metrics: [
    { value: '50%', label: 'of routine tasks automated' },
    { value: '3x', label: 'faster onboarding' },
  ],
};

const zone = () => screen.queryByTestId('case-study-metric');

describe('CaseStudyCard regular densities', () => {
  it.each(['default', 'portrait', 'sm', 'menu'] as const)('never shows a metric on the %s card', size => {
    render(<CaseStudyCard study={withMetrics} href="/case-studies/acme" size={size} placeholderUrl={null} />);
    expect(screen.queryByText('50%')).toBeNull();
    expect(zone()).toBeNull();
  });
});

describe('CaseStudyCard result size', () => {
  it('shows who, the first metric large, the title and the way in', () => {
    render(
      <CaseStudyCard
        study={{
          ...withMetrics,
          user: { id: 'u1', full_name: 'Tyson Wilcox', job_title: 'CEO' } as CaseStudyCardData['user'],
        }}
        href="/case-studies/acme"
        size="result"
        placeholderUrl={null}
      />,
    );
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('of routine tasks automated')).toBeTruthy();
    expect(screen.queryByText('3x')).toBeNull();
    expect(screen.getByText('Tyson Wilcox')).toBeTruthy();
    expect(screen.getByText(withMetrics.title)).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/case-studies/acme');
  });

  it('renders nothing for a story with no metric', () => {
    render(<CaseStudyCard study={base} href="/case-studies/acme" size="result" placeholderUrl={null} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(zone()).toBeNull();
  });

  it('takes the page accent for the metric', () => {
    render(
      <CaseStudyCard
        study={withMetrics}
        href="/case-studies/acme"
        size="result"
        accentClassName="text-ods-flamingo-cyan-base"
        placeholderUrl={null}
      />,
    );
    expect(screen.getByText('50%').className).toContain('text-ods-flamingo-cyan-base');
  });

  it('has a skeleton in the same boxes', () => {
    render(<CaseStudyCardSkeleton size="result" />);
    render(<CaseStudyCard study={withMetrics} href="/case-studies/acme" size="result" placeholderUrl={null} />);
    expect(screen.getByTestId('case-study-result-skeleton-metric').className).toContain('h-[112px]');
    expect(zone()?.className).toContain('h-[112px]');
  });
});
