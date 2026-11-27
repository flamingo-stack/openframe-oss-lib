/** With a model menu the model name is the button that opens it; a lock keeps the name and the menu shut. */

import { fireEvent, queryHelpers, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelDisplay } from '../model-display';
import type { ModelMenu } from '../types';

const pick = vi.fn();
const menu = (disabled = false): ModelMenu => ({
  disabled,
  groups: [{ items: [{ id: 'default', label: 'Use Default Model', type: 'radio', checked: true, onClick: pick }] }],
});

const comparisonMenu = {
  mobileDrillDown: true,
  groups: [
    {
      items: [
        {
          id: 'anthropic',
          label: 'Anthropic',
          type: 'submenu' as const,
          submenuWidth: 440,
          footer: 'Rate and price notes',
          submenu: [
            {
              id: 'opus',
              label: 'Claude Opus 4.8',
              description: 'Complex work. Price $5 and $25.',
              content: <span>Claude Opus 4.8 · $5 / $25</span>,
              type: 'radio' as const,
              checked: true,
              onClick: pick,
            },
          ],
        },
      ],
    },
  ],
};

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
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1440);
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(900);
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  it('exposes a rich model row as a single labelled radio choice on desktop', async () => {
    render(show(comparisonMenu));
    open(screen.getByRole('button', { name: 'Chat model: Claude Opus 4.8' }));
    const provider = await screen.findByRole('menuitem', { name: 'Anthropic' });
    await waitFor(() => expect(provider).toHaveFocus());
    fireEvent.keyDown(provider, { key: 'ArrowRight' });

    const choice = await screen.findByRole('menuitemradio', { name: 'Claude Opus 4.8' });
    expect(within(choice).getByText('Claude Opus 4.8 · $5 / $25')).toBeVisible();
    expect(choice).toHaveAccessibleDescription('Complex work. Price $5 and $25.');
    fireEvent.click(choice);
    expect(pick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('uses one mobile menu and restores the provider focus when navigating back', async () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(430);
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(show(comparisonMenu));
    const trigger = screen.getByRole('button', { name: 'Chat model: Claude Opus 4.8' });
    open(trigger);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Anthropic' }));

    const back = await screen.findByRole('menuitem', { name: 'Back to providers from Anthropic' });
    await waitFor(() => expect(back).toHaveFocus());
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    expect(screen.getByRole('menuitemradio', { name: 'Claude Opus 4.8' })).toBeVisible();
    expect(within(screen.getByTestId('actions-menu-rows')).queryByText('Rate and price notes')).toBeNull();
    expect(screen.getByText('Rate and price notes')).toBeVisible();
    fireEvent.click(back);

    const provider = await screen.findByRole('menuitem', { name: 'Anthropic' });
    await waitFor(() => expect(provider).toHaveFocus());
    expect(screen.queryByRole('menuitemradio')).toBeNull();
    fireEvent.keyDown(provider, { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('applies the horizontal gutter and toolbar clearance after the mobile portal mounts', async () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(430);
    vi.spyOn(document.documentElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 430, 900));
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(show(comparisonMenu));
    const trigger = screen.getByRole('button', { name: 'Chat model: Claude Opus 4.8' });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(12, 600, 200, 24));
    open(trigger);

    await screen.findByRole('menu');
    // jsdom gives the floating anchor no layout. The simulated transform contains the measured 16 - 12 correction.
    await waitFor(() => {
      const popup = queryHelpers.queryByAttribute('data-radix-popper-content-wrapper', document.body, '');
      expect(popup?.style.transform).toMatch(/^translate\(4px,/);
      // The trigger starts at y=600, with a 4px gap and 64px toolbar clearance above it.
      expect(popup?.style.getPropertyValue('--radix-popper-available-height')).toBe('532px');
    });
  });

  it.each(['desktop', 'mobile'])(
    'lets keyboard users scroll overflowed %s notes and return to their model',
    async layout => {
      if (layout === 'mobile') {
        vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(430);
        vi.stubGlobal('matchMedia', () => ({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }));
      }
      render(show(comparisonMenu));
      open(screen.getByRole('button', { name: 'Chat model: Claude Opus 4.8' }));
      const provider = await screen.findByRole('menuitem', { name: 'Anthropic' });
      await waitFor(() => expect(provider).toHaveFocus());
      fireEvent.keyDown(provider, { key: 'ArrowRight' });

      const model = await screen.findByRole('menuitemradio', { name: 'Claude Opus 4.8' });
      const notes = screen.getByRole('group', { name: 'Menu notes' });
      vi.spyOn(notes, 'clientHeight', 'get').mockReturnValue(45);
      vi.spyOn(notes, 'scrollHeight', 'get').mockReturnValue(80);
      model.focus();
      fireEvent.keyDown(model, { key: 'Tab' });
      expect(notes).toHaveFocus();

      fireEvent.keyDown(notes, { key: 'End' });
      expect(notes.scrollTop).toBe(80);
      fireEvent.keyDown(notes, { key: 'Home' });
      expect(notes.scrollTop).toBe(0);
      fireEvent.keyDown(notes, { key: 'Tab', shiftKey: true });
      expect(model).toHaveFocus();
    },
  );
});
