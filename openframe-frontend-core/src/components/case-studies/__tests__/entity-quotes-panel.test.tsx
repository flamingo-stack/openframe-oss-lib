import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EntityQuotesPanel } from '../entity-quotes-panel';

describe('EntityQuotesPanel', () => {
  it('draws each quote with its speaker under a counted caption', () => {
    render(
      <EntityQuotesPanel
        quotes={[
          { key: 'a', text: 'Deployment is beautifully fast', speaker: 'Jane Doe, CTO' },
          { key: 'b', text: 'We dropped two tools' },
        ]}
      />,
    );
    expect(screen.getByText('Key Quotes · 2')).toBeTruthy();
    expect(screen.getByText('“Deployment is beautifully fast”')).toBeTruthy();
    expect(screen.getByText('Jane Doe, CTO')).toBeTruthy();
    expect(screen.getByText('“We dropped two tools”')).toBeTruthy();
  });

  it('renders nothing without quotes', () => {
    render(<EntityQuotesPanel quotes={[]} />);
    expect(screen.queryByText(/Key Quotes/)).toBeNull();
  });
});
