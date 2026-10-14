/**
 * `SuggestionsDisplay` - the grouped prompt chips of a `suggestions` segment.
 *
 * Pins: captions, chips and the note render; a chip hands its PROMPT (not its
 * label, when they differ) to the segment's `onPick`, else to the composer of
 * the chat panel around it; and with neither the chips do nothing.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChatPanelContext } from '../chat-panel-context';
import { SuggestionsDisplay } from '../suggestions-display';
import type { SuggestionsSegment } from '../types/message.types';

const segment = (onPick?: (prompt: string) => void): SuggestionsSegment => ({
  type: 'suggestions',
  groups: [
    { label: 'Diagnose', prompts: [{ label: 'Why is my laptop slow?' }] },
    { label: 'Fix', prompts: [{ label: 'Free up space', prompt: 'My disk is almost full, can you free up space?' }] },
  ],
  note: 'Click one to put it in the composer, then send.',
  onPick,
});

describe('SuggestionsDisplay', () => {
  it('renders each group caption, its chips and the note', () => {
    render(<SuggestionsDisplay segment={segment()} />);

    expect(screen.getByText('Diagnose')).toBeInTheDocument();
    expect(screen.getByText('Fix')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Why is my laptop slow?' })).toBeInTheDocument();
    expect(screen.getByText('Click one to put it in the composer, then send.')).toBeInTheDocument();
  });

  it("hands the chip's prompt to onPick", () => {
    const onPick = vi.fn();
    render(<SuggestionsDisplay segment={segment(onPick)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Free up space' }));
    expect(onPick).toHaveBeenCalledWith('My disk is almost full, can you free up space?');
    fireEvent.click(screen.getByRole('button', { name: 'Why is my laptop slow?' }));
    expect(onPick).toHaveBeenLastCalledWith('Why is my laptop slow?');
  });

  it("falls back to the chat panel's composer", () => {
    const fillComposer = vi.fn();
    render(
      <ChatPanelContext.Provider value={{ closeChat: vi.fn(), fillComposer }}>
        <SuggestionsDisplay segment={segment()} />
      </ChatPanelContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Why is my laptop slow?' }));
    expect(fillComposer).toHaveBeenCalledWith('Why is my laptop slow?');
  });
});
