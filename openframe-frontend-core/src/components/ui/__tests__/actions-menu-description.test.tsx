import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionsMenu } from '../actions-menu';

describe('ActionsMenu item description', () => {
  it('draws the description in the row as secondary text, apart from the label', () => {
    render(
      <ActionsMenu groups={[{ items: [{ id: 'poke', label: 'Poke on Slack', description: 'last poked 2h ago' }] }]} />,
    );
    const row = screen.getByRole('menuitem', { name: /Poke on Slack/ });
    // The label is its own text: the description is never folded into it.
    expect(within(row).getByText('Poke on Slack')).toBeInTheDocument();
    expect(within(row).getByText('last poked 2h ago')).toHaveClass('text-ods-text-secondary');
  });

  it('draws a row with no description as before', () => {
    render(<ActionsMenu groups={[{ items: [{ id: 'snooze', label: 'Snooze' }] }]} />);
    expect(screen.getByRole('menuitem', { name: 'Snooze' })).toBeInTheDocument();
    expect(screen.queryByText(/last poked/)).not.toBeInTheDocument();
  });
});
