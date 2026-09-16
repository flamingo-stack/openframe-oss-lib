import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuoteCardsStrip } from '../quote-cards-strip';

const QUOTE = {
  key: 'q1',
  text: 'Deployment is beautifully fast',
  attribution: 'Albert Guerra, Owner',
  logoUrl: null,
  href: '/case-studies/black-rabbit',
};

describe('QuoteCardsStrip', () => {
  it('links each chip to the case study its quote comes from', () => {
    render(<QuoteCardsStrip quotes={[QUOTE]} />);
    const links = screen.getAllByRole('link', { name: `${QUOTE.text}, ${QUOTE.attribution}` });
    expect(links[0].getAttribute('href')).toBe(QUOTE.href);
  });

  it('renders nothing without quotes', () => {
    render(<QuoteCardsStrip quotes={[]} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
