/** With a model menu the model name is the button that opens it; a lock keeps the name and the menu shut. */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelDisplay } from '../model-display';
import type { ModelMenu } from '../types';

const pick = vi.fn();
const menu = (disabled = false): ModelMenu => ({
  disabled,
  groups: [{ items: [{ id: 'default', label: 'Use Default Model', type: 'radio', checked: true, onClick: pick }] }],
});

function show(modelMenu: ModelMenu) {
  return (
    <ModelDisplay
      provider="ANTHROPIC"
      modelName="Claude Opus 4.8"
      usedTokens={12_300}
      contextWindow={150_000}
      modelMenu={modelMenu}
    />
  );
}

function open(button: HTMLElement) {
  fireEvent.pointerDown(button, { button: 0, pointerType: 'mouse' });
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 600, 200, 24));
});
afterEach(() => {
  vi.restoreAllMocks();
  pick.mockReset();
});

describe('ModelDisplay model menu', () => {
  it('opens the menu from the model name and keeps the budget beside it', async () => {
    render(show(menu()));
    const button = screen.getByRole('button', { name: 'Chat model: Claude Opus 4.8' });
    expect(screen.getByText('12.3K/150K context budget')).toBeInTheDocument();

    open(button);
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Use Default Model' }));
    expect(pick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on a lock, keeps the same button, and does not reopen when the lock lifts', async () => {
    const { rerender } = render(show(menu()));
    const button = screen.getByRole('button', { name: 'Chat model: Claude Opus 4.8' });
    open(button);
    await screen.findByRole('menu');

    rerender(show(menu(true)));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Chat model: Claude Opus 4.8' })).toBe(button);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    open(button);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    rerender(show(menu()));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
