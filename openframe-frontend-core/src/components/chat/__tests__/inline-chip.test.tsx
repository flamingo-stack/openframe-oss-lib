import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InlineChip, type InlineChipAnchor } from '../inline-chip';

const icon = <svg data-testid="icon" />;
const action = <button type="button">more</button>;
const link = (content: React.ReactNode, anchor: InlineChipAnchor) => (
  <a href="/x" aria-label={anchor.label} aria-hidden={anchor.hidden || undefined}>
    {content}
  </a>
);

/** The one box the last word and the action share, which a line cannot break. */
const unbrokenBoxOf = (element: HTMLElement) => element.closest('.whitespace-nowrap');

describe('InlineChip', () => {
  it('draws its label in the inline box', () => {
    render(<InlineChip label="Devices → Add Device" />);
    expect(screen.getByTestId('inline-chip')).toHaveTextContent('Devices → Add Device');
  });

  describe('a line never breaks between the icon and the name', () => {
    /**
     * The icon stands in the start padding of the box that holds the name, out of flow, so nothing the browser could break
     * at comes between it and the first letter (`inline-block` beside the text was a break opportunity whatever the text
     * said). An inline box's padding goes where its first letter goes, and a word does not break, so the icon stays with
     * the first word, and every later word still wraps with the line.
     */
    const expectIconHeld = (name: HTMLElement) => {
      const held = screen.getByTestId('icon').parentElement as HTMLElement;
      expect(held.parentElement).toBe(name);
      expect(held).toHaveClass('absolute');
      expect(name.className).toMatch(/\bps-\[/);
      expect(name).toHaveClass('relative');
      expect(name.firstElementChild).toBe(held);
    };

    it('with no action and no link: the whole name is one piece of text, free to wrap', () => {
      render(<InlineChip icon={icon} label="Platform overview" />);
      const name = screen.getByText('Platform overview');
      expectIconHeld(name);
      expect(unbrokenBoxOf(name)).toBeNull();
    });

    it('with no action, inside its link', () => {
      render(<InlineChip icon={icon} label="Platform overview" link={link} />);
      const name = screen.getByText('Platform overview');
      expectIconHeld(name);
      expect(name.closest('a')).toHaveAttribute('href', '/x');
    });

    it('a name that is no string (markdown link children) holds it too', () => {
      render(<InlineChip icon={icon} label={<strong>Devices</strong>} />);
      expectIconHeld(screen.getByText('Devices').parentElement as HTMLElement);
      expect(screen.getByTestId('inline-chip')).toHaveTextContent('Devices');
    });

    it('with an action: on the first word, and the last word keeps the action', () => {
      render(<InlineChip icon={icon} label="Platform overview" link={link} trailing={action} />);
      const name = screen.getByText('Platform');
      expectIconHeld(name);
      expect(name.closest('a')).toHaveAttribute('aria-label', 'Platform overview');
      const last = screen.getByText('overview');
      expect(unbrokenBoxOf(last)).toBe(unbrokenBoxOf(screen.getByRole('button', { name: 'more', hidden: true })));
      expect(unbrokenBoxOf(name)).toBeNull();
    });

    it('with an action and a long name: the words between are free to wrap', () => {
      render(<InlineChip icon={icon} label="Solo MSP endpoint cleanup" link={link} trailing={action} />);
      const name = screen.getByText('Solo MSP endpoint');
      expectIconHeld(name);
      expect(unbrokenBoxOf(name)).toBeNull();
      expect(unbrokenBoxOf(screen.getByText('cleanup'))).toBeTruthy();
    });

    it('a one-word name with an action: icon, word and action are one unbroken piece', () => {
      render(<InlineChip icon={icon} label="MacBook" link={link} trailing={action} />);
      const name = screen.getByText('MacBook');
      expectIconHeld(name);
      expect(unbrokenBoxOf(name)).toBe(unbrokenBoxOf(screen.getByRole('button', { name: 'more', hidden: true })));
    });

    it('with no icon there is no box and no padding', () => {
      render(<InlineChip label="Plain" />);
      expect(screen.getByTestId('inline-chip').className).not.toMatch(/\bps-\[/);
      expect(within(screen.getByTestId('inline-chip')).getByText('Plain')).toBe(screen.getByTestId('inline-chip'));
    });
  });
});
