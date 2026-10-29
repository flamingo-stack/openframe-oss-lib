import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveIcon } from '../icon-library';

describe('an icon of the generated set', () => {
  it('holds its place with an empty svg of its own size, then draws when its module arrives', async () => {
    const Icon = resolveIcon('chart-pie');
    render(<Icon size={18} className="probe" data-testid="icon" />);

    // Never a Suspense fallback: the placeholder is the icon's own element.
    const placeholder = screen.getByTestId('icon');
    expect(placeholder.tagName.toLowerCase()).toBe('svg');
    expect(placeholder).toHaveAttribute('width', '18');
    expect(placeholder).toHaveClass('probe');
    expect(placeholder).toBeEmptyDOMElement();

    await waitFor(() => expect(screen.getByTestId('icon')).not.toBeEmptyDOMElement());
    expect(screen.getByTestId('icon')).toHaveAttribute('width', '18');
  });
});
