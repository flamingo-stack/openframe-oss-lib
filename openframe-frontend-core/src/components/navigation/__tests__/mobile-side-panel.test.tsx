import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_SIDE_PANEL_SWIPE_CLOSE_PX, MobileSidePanel } from '../mobile-side-panel';

function renderPanel({ open = true, side }: { open?: boolean; side?: 'left' | 'right' } = {}) {
  const onClose = vi.fn();
  render(
    <MobileSidePanel open={open} onClose={onClose} label="Chats" side={side}>
      <button type="button">Start New Chat</button>
    </MobileSidePanel>,
  );
  return { onClose, panel: screen.getByRole('dialog', { name: 'Chats', hidden: true }) };
}

/** A one-finger gesture over the panel: from (x0, y0) to (x1, y1), then lifted. */
function swipe(panel: HTMLElement, [x0, y0]: [number, number], [x1, y1]: [number, number]) {
  fireEvent.touchStart(panel, { touches: [{ clientX: x0, clientY: y0 }] });
  fireEvent.touchMove(panel, { touches: [{ clientX: x1, clientY: y1 }] });
  fireEvent.touchEnd(panel, { touches: [] });
}

describe('MobileSidePanel', () => {
  it('slides in from the left below the top bar, 320px, the whole width under 400px', () => {
    const { panel } = renderPanel();
    const classes = panel.className.split(' ');
    expect(classes).toEqual(expect.arrayContaining(['left-0', 'translate-x-0', 'w-full', 'min-[400px]:w-[320px]']));
    expect(screen.getByTestId('mobile-side-panel-layer').style.top).toBe('56px');
    expect(screen.getByTestId('mobile-side-panel-layer').className).toContain('md:hidden');
    expect(screen.getByRole('button', { name: 'Start New Chat' })).toBeTruthy();
  });

  it('waits off screen, inert, while closed, its content still mounted', () => {
    const { panel } = renderPanel({ open: false });
    expect(panel.className.split(' ')).toContain('-translate-x-full');
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('button', { name: 'Start New Chat', hidden: true })).toBeTruthy();
  });

  it('closes on a tap on the scrim and on Escape', () => {
    const { onClose, panel } = renderPanel();
    fireEvent.click(screen.getByTestId('mobile-side-panel-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes on a swipe towards its edge, and springs back from a short one', () => {
    const { onClose, panel } = renderPanel();
    swipe(panel, [200, 300], [200 - MOBILE_SIDE_PANEL_SWIPE_CLOSE_PX + 10, 305]);
    expect(onClose).not.toHaveBeenCalled();
    swipe(panel, [200, 300], [200 - MOBILE_SIDE_PANEL_SWIPE_CLOSE_PX - 10, 305]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a quick flick that moves and lifts before a render', () => {
    const { onClose, panel } = renderPanel();
    const touch = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, 'touches', { value: touches });
      return event;
    };
    // Dispatched straight, outside act: no render between the move and the lift, as with a real flick.
    panel.dispatchEvent(touch('touchstart', [{ clientX: 250, clientY: 300 }]));
    panel.dispatchEvent(touch('touchmove', [{ clientX: 150, clientY: 300 }]));
    panel.dispatchEvent(touch('touchend', []));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('follows the finger while it swipes, and lets go after', () => {
    const { panel } = renderPanel();
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 300 }] });
    fireEvent.touchMove(panel, { touches: [{ clientX: 160, clientY: 302 }] });
    expect(panel.style.transform).toBe('translateX(-40px)');
    fireEvent.touchEnd(panel, { touches: [] });
    expect(panel.style.transform).toBe('');
  });

  it('leaves a vertical gesture to the list (no close), and a swipe away from its edge', () => {
    const { onClose, panel } = renderPanel();
    swipe(panel, [200, 300], [190, 100]);
    swipe(panel, [100, 300], [300, 300]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('from the right, slides from the right and closes on a swipe right', () => {
    const { onClose, panel } = renderPanel({ side: 'right' });
    expect(panel.className.split(' ')).toContain('right-0');
    swipe(panel, [100, 300], [100 + MOBILE_SIDE_PANEL_SWIPE_CLOSE_PX + 10, 300]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('when the window is md or wider (the panel hidden by CSS)', () => {
    const original = window.matchMedia;
    afterEach(() => {
      window.matchMedia = original;
    });

    it('locks no scroll and traps no focus, even while open', () => {
      window.matchMedia = (query: string) =>
        ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList;
      const { onClose, panel } = renderPanel();
      expect(document.documentElement.style.overflow).not.toBe('hidden');
      fireEvent.keyDown(panel, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('locks the page scroll while open on a phone', () => {
    renderPanel();
    expect(document.documentElement.style.overflow).toBe('hidden');
  });
});
