/**
 * The model row's token tail is the chat's context budget (the agent compacts the chat's
 * memory before it fills), not the model's window: it says so, and only once the budget
 * is known.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModelDisplay } from '../model-display';

describe('ModelDisplay context budget', () => {
  it('shows the tokens held against the budget', () => {
    render(<ModelDisplay provider="anthropic" modelName="Claude" usedTokens={12_300} contextWindow={150_000} />);
    expect(screen.getByText('12.3K/150K context budget')).toBeInTheDocument();
  });

  it('shows the budget before the first usage arrives', () => {
    render(<ModelDisplay provider="anthropic" modelName="Claude" contextWindow={150_000} />);
    expect(screen.getByText('—/150K context budget')).toBeInTheDocument();
  });

  it('has no tail while the budget is unknown', () => {
    render(<ModelDisplay provider="anthropic" modelName="Claude" usedTokens={12_300} />);
    expect(screen.queryByText(/context budget/)).not.toBeInTheDocument();
  });
});
