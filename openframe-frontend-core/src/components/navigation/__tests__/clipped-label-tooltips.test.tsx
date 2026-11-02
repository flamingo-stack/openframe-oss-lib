import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOVER_MEDIA_QUERY } from '../../../hooks/ui/use-clipped-label-tooltip';
import { ChatListItem } from '../../chat/chat-nav-sidebar';
import { AccountPopover } from '../account-popover';
import { NavigationSidebarActionRow } from '../navigation-sidebar-grouped';
import { NavigationSidebarItemButton } from '../navigation-sidebar-item';

// jsdom lays nothing out: the test says whether a label overflows its box.
function layout(scrollWidth: number, clientWidth: number) {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => scrollWidth });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => clientWidth });
}

/** The device's pointer: one that can hover (a mouse), or none (a touch screen). */
function pointer(canHover: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: canHover && query === HOVER_MEDIA_QUERY,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => pointer(true));

afterEach(() => {
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
});

/**
 * Points at the label and reports whether a tooltip opened. The tooltip listens for `mouseenter` on its trigger,
 * the wrapper around the label, which a real pointer enters on its way to the text: so the event bubbles.
 */
async function tooltipOnHover(label: string): Promise<HTMLElement | null> {
  fireEvent(screen.getByText(label), new MouseEvent('mouseenter', { bubbles: true }));
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  return screen.queryByRole('tooltip');
}

const LABEL = 'Knowledge base articles and guides';
const icon = <svg data-testid="icon" />;

describe('sidebar labels a narrow sidebar clips', () => {
  it('a navigation item shows its full label in a tooltip only while clipped', async () => {
    layout(300, 100);
    const { unmount } = render(
      <NavigationSidebarItemButton
        item={{ id: 'kb', label: LABEL, icon, path: '/knowledge-base' }}
        isActive={false}
        isPending={false}
        showLabel
        disabled={false}
        onClick={vi.fn()}
      />,
    );
    expect(await tooltipOnHover(LABEL)).toHaveTextContent(LABEL);
    unmount();

    layout(100, 100);
    render(
      <NavigationSidebarItemButton
        item={{ id: 'kb', label: LABEL, icon, path: '/knowledge-base' }}
        isActive={false}
        isPending={false}
        showLabel
        disabled={false}
        onClick={vi.fn()}
      />,
    );
    expect(await tooltipOnHover(LABEL)).toBeNull();
  });

  it('a chat row shows its full title in a tooltip only while clipped', async () => {
    layout(300, 100);
    const { unmount } = render(<ChatListItem title={LABEL} />);
    expect(await tooltipOnHover(LABEL)).toHaveTextContent(LABEL);
    unmount();

    layout(100, 100);
    render(<ChatListItem title={LABEL} />);
    expect(await tooltipOnHover(LABEL)).toBeNull();
  });

  it('the account row shows its full name and subtitle in tooltips only while clipped', async () => {
    layout(300, 100);
    const { unmount } = render(
      <AccountPopover name="Ada Lovelace of Analytical Engines" subtitle="acme-corporation.openframe.ai" items={[]} />,
    );
    expect(await tooltipOnHover('Ada Lovelace of Analytical Engines')).toHaveTextContent(
      'Ada Lovelace of Analytical Engines',
    );
    unmount();

    layout(100, 100);
    render(
      <AccountPopover name="Ada Lovelace of Analytical Engines" subtitle="acme-corporation.openframe.ai" items={[]} />,
    );
    expect(await tooltipOnHover('acme-corporation.openframe.ai')).toBeNull();
  });

  it('a grouped sidebar row shows its full label in a tooltip only while clipped', async () => {
    layout(300, 100);
    const { unmount } = render(<NavigationSidebarActionRow icon={icon} label={LABEL} onClick={vi.fn()} />);
    expect(await tooltipOnHover(LABEL)).toHaveTextContent(LABEL);
    unmount();

    layout(100, 100);
    render(<NavigationSidebarActionRow icon={icon} label={LABEL} onClick={vi.fn()} />);
    expect(await tooltipOnHover(LABEL)).toBeNull();
  });

  it('offers no tooltip on a device without hover (a touch screen), however clipped', async () => {
    pointer(false);
    layout(300, 100);
    render(<ChatListItem title={LABEL} />);
    expect(await tooltipOnHover(LABEL)).toBeNull();
  });

  it('the rail keeps its own tooltip: no overflow tooltip while minimized', async () => {
    layout(300, 100);
    render(<NavigationSidebarActionRow icon={icon} label={LABEL} onClick={vi.fn()} minimized />);
    expect(await tooltipOnHover(LABEL)).toBeNull();
  });

  it('the rail keeps its own tooltip: no overflow tooltip while collapsed', async () => {
    layout(300, 100);
    render(<AccountPopover name="Ada Lovelace of Analytical Engines" items={[]} collapsed />);
    expect(await tooltipOnHover('Ada Lovelace of Analytical Engines')).toBeNull();
  });
});
