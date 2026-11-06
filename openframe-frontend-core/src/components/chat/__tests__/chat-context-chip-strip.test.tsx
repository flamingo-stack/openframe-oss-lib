/**
 * `ChatContextChipStrip` `onSelect`: a chip whose face is a button (the page the
 * composer sits on, asked about on a click), its × still its own button.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatContextChipStrip } from '../chat-context-picker';

const PAGE = { type: 'PAGE', id: '/devices', label: 'Devices' };

describe('ChatContextChipStrip - onSelect', () => {
  it('hands the clicked chip to onSelect, named by its hint', () => {
    const onSelect = vi.fn();
    render(<ChatContextChipStrip items={[PAGE]} onSelect={onSelect} selectHint="Ask about this page" />);

    fireEvent.click(screen.getByRole('button', { name: 'Ask about this page: Devices' }));

    expect(onSelect).toHaveBeenCalledWith(PAGE);
  });

  it('keeps the × apart: removing does not select', () => {
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    render(<ChatContextChipStrip items={[PAGE]} onSelect={onSelect} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Devices' }));

    expect(onRemove).toHaveBeenCalledWith(PAGE);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('draws a plain label without onSelect', () => {
    render(<ChatContextChipStrip items={[PAGE]} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Devices')).toBeInTheDocument();
  });

  it('does not select while disabled', () => {
    const onSelect = vi.fn();
    render(<ChatContextChipStrip items={[PAGE]} onSelect={onSelect} disabled />);

    fireEvent.click(screen.getByRole('button', { name: 'Devices' }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
