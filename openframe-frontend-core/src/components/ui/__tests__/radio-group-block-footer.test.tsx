/**
 * `RadioGroupBlock` option `footer`: content under the option's row, inside the
 * option. An option without one renders exactly as before.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroupBlock } from '../radio-group';

const OPTIONS = [
  { value: 'skip', label: 'Skip this Run' },
  { value: 'retry', label: 'Run when device comes back online', footer: <span>Stop Retry after</span> },
];

describe('RadioGroupBlock option footer', () => {
  it('renders the footer inside its own option, so it is part of that choice', () => {
    render(<RadioGroupBlock name="offline" options={OPTIONS} />);
    expect(screen.getByRole('radio', { name: /Run when device comes back online/ })).toHaveAccessibleName(
      'Run when device comes back online Stop Retry after',
    );
    expect(screen.getByRole('radio', { name: 'Skip this Run' })).toBeInTheDocument();
  });

  it('selects its option when the footer is clicked', () => {
    const onValueChange = vi.fn();
    render(<RadioGroupBlock name="offline" options={OPTIONS} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByText('Stop Retry after'));
    expect(onValueChange).toHaveBeenCalledWith('retry');
  });
});
