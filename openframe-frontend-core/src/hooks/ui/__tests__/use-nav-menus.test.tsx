import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNavMenus } from '../use-nav-menus';

function Menus({ pathname = '/' }: { pathname?: string }) {
  const { openId, close, getTriggerProps, getPanelProps } = useNavMenus({ pathname });
  return (
    <div>
      <output data-testid="open">{openId ?? 'none'}</output>
      {['a', 'b'].map(id => (
        <div key={id}>
          <button type="button" {...getTriggerProps(id)}>
            trigger {id}
          </button>
          <div {...getPanelProps(id)} data-testid={`panel-${id}`}>
            <a href={`/${id}`}>link {id}</a>
          </div>
        </div>
      ))}
      <button type="button" onClick={close}>
        close
      </button>
      <p>outside</p>
    </div>
  );
}

const openId = () => screen.getByTestId('open').textContent;
const trigger = (id: string) => screen.getByRole('button', { name: `trigger ${id}` });
const panel = (id: string) => screen.getByTestId(`panel-${id}`);
const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('useNavMenus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('wires the trigger to its panel and keeps a closed panel inert', () => {
    render(<Menus />);
    expect(trigger('a')).toHaveAttribute('aria-expanded', 'false');
    expect(trigger('a')).toHaveAttribute('aria-controls', panel('a').id);
    expect(panel('a')).toHaveAttribute('inert');

    fireEvent.click(trigger('a'));
    expect(trigger('a')).toHaveAttribute('aria-expanded', 'true');
    expect(panel('a')).not.toHaveAttribute('inert');
    expect(panel('a')).toHaveAttribute('data-state', 'open');
  });

  it('toggles on click', () => {
    render(<Menus />);
    fireEvent.click(trigger('a'));
    expect(openId()).toBe('a');
    fireEvent.click(trigger('a'));
    expect(openId()).toBe('none');
  });

  it('opens on hover only after the intent delay', () => {
    render(<Menus />);
    fireEvent.mouseEnter(trigger('a'));
    advance(149);
    expect(openId()).toBe('none');
    advance(1);
    expect(openId()).toBe('a');
  });

  it('a click on a menu the hover opened keeps it open; the next click closes it', () => {
    render(<Menus />);
    fireEvent.mouseEnter(trigger('a'));
    advance(1000);
    expect(openId()).toBe('a');
    fireEvent.click(trigger('a'));
    expect(openId()).toBe('a');
    fireEvent.click(trigger('a'));
    expect(openId()).toBe('none');
  });

  it('does not open when the pointer leaves before the intent delay', () => {
    render(<Menus />);
    fireEvent.mouseEnter(trigger('a'));
    advance(100);
    fireEvent.mouseLeave(trigger('a'));
    advance(1000);
    expect(openId()).toBe('none');
  });

  it('closes 300ms after the pointer leaves the trigger', () => {
    render(<Menus />);
    fireEvent.click(trigger('a'));
    fireEvent.mouseLeave(trigger('a'));
    advance(299);
    expect(openId()).toBe('a');
    advance(1);
    expect(openId()).toBe('none');
  });

  it('cancels the close when the pointer enters the panel, and restarts it on leaving', () => {
    render(<Menus />);
    fireEvent.click(trigger('a'));
    fireEvent.mouseLeave(trigger('a'));
    advance(200);
    fireEvent.mouseEnter(panel('a'));
    advance(1000);
    expect(openId()).toBe('a');

    fireEvent.mouseLeave(panel('a'));
    advance(300);
    expect(openId()).toBe('none');
  });

  it('keeps one menu open at a time', () => {
    render(<Menus />);
    fireEvent.click(trigger('a'));
    fireEvent.click(trigger('b'));
    expect(openId()).toBe('b');
    expect(trigger('a')).toHaveAttribute('aria-expanded', 'false');
    expect(panel('a')).toHaveAttribute('inert');

    // Hovering the other trigger switches after the intent delay, and the
    // pending close of the first never fires over it.
    fireEvent.mouseLeave(trigger('b'));
    fireEvent.mouseEnter(trigger('a'));
    advance(150);
    expect(openId()).toBe('a');
    advance(1000);
    expect(openId()).toBe('a');
  });

  it('a click drops the pending hover open, so a tap cannot reopen what it closed', () => {
    render(<Menus />);
    fireEvent.click(trigger('a'));
    fireEvent.mouseEnter(trigger('b'));
    fireEvent.click(trigger('b'));
    fireEvent.click(trigger('b'));
    advance(1000);
    expect(openId()).toBe('none');
  });

  it('with a menu open, hovering another trigger switches at once, and the tap that did it keeps it open', () => {
    render(<Menus />);
    fireEvent.click(trigger('a'));
    fireEvent.mouseEnter(trigger('b'));
    expect(openId()).toBe('b');
    // A touch tap: mouseenter (the switch above), then its own click.
    fireEvent.click(trigger('b'));
    expect(openId()).toBe('b');
  });

  it('Escape closes and returns focus to the trigger', () => {
    render(<Menus />);
    fireEvent.click(trigger('a'));
    screen.getByRole('link', { name: 'link a' }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(openId()).toBe('none');
    expect(trigger('a')).toHaveFocus();
  });

  it('closes on a pointer-down outside, not inside the panel or on a trigger', () => {
    render(<Menus />);
    fireEvent.click(trigger('a'));
    fireEvent.pointerDown(screen.getByRole('link', { name: 'link a' }));
    expect(openId()).toBe('a');
    fireEvent.pointerDown(trigger('b'));
    expect(openId()).toBe('a');
    fireEvent.pointerDown(screen.getByText('outside'));
    expect(openId()).toBe('none');
  });

  it('closes when the pathname changes', () => {
    const { rerender } = render(<Menus pathname="/" />);
    fireEvent.click(trigger('a'));
    expect(openId()).toBe('a');
    rerender(<Menus pathname="/pricing" />);
    expect(openId()).toBe('none');
    // And stays closed on coming back.
    rerender(<Menus pathname="/" />);
    expect(openId()).toBe('none');
  });

  it('close() closes the open menu', () => {
    render(<Menus />);
    fireEvent.click(trigger('a'));
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(openId()).toBe('none');
  });
});
