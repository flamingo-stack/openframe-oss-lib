import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageTopicsProvider } from '../../../contexts/page-topics-context';
import { GuideWelcome } from '../guide-welcome';
import { MingoQuickActionWall, QuickActionSet } from '../mingo-quick-action-wall';
import { MingoWelcome } from '../mingo-welcome';
import { quickActionAccentTint } from '../quick-action-chip';
import { QuickActionRow, sharedChipAccent } from '../quick-action-row';

const ACTIONS = [
  { id: 'qa-1', label: 'Patching', prompt: 'Check my fleet for pending patches.', onClick: vi.fn() },
  { id: 'qa-2', label: 'Disk Scan', prompt: 'Run a quick disk scan.', onClick: vi.fn() },
];

const chipsOf = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `c-${i}`,
    label: `Action ${i}`,
    onSelect: vi.fn(),
    onHoverStart: vi.fn(),
    onHoverEnd: vi.fn(),
  }));

const scroller = () => screen.getByTestId('quick-action-row-scroller');
const allTag = () => screen.getByRole('button', { name: 'All quick actions' });
const loadingTags = () => screen.queryAllByTestId('quick-action-row-loading-tag');

/** A window from `md` up: the All list is the menu (the test setup's default is a phone, where it is the sheet). */
function wideWindow() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    query =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

/** The row is `visible` px wide and its tags take `content` px: jsdom lays nothing out. */
function rowWidths(content: number, visible: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(content);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(visible);
}

const openAllMenu = () => {
  fireEvent.pointerDown(allTag(), { button: 0, pointerType: 'mouse' });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QuickActionRow', () => {
  it.each([1, 3, 40])('draws every one of %i actions as a tag of the one row, and All', count => {
    render(<QuickActionRow chips={chipsOf(count)} />);
    expect(within(scroller()).getAllByRole('button')).toHaveLength(count);
    expect(allTag()).toBeTruthy();
  });

  it('draws nothing with no action: no row, no All', () => {
    const { container } = render(<QuickActionRow chips={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("holds its place while the actions are read: its tags' loading form, nothing to press, no All", () => {
    render(<QuickActionRow chips={[]} loading />);
    expect(loadingTags()).toHaveLength(4);
    for (const tag of loadingTags()) expect(tag).toHaveAttribute('data-loading-item');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(scroller()).not.toHaveAttribute('data-fade-right');
  });

  it('is one labelled group of buttons', () => {
    render(<QuickActionRow chips={chipsOf(2)} label="Suggested questions" />);
    expect(screen.getByRole('group', { name: 'Suggested questions' })).toBeTruthy();
  });

  it('never cuts a name: its tags do not shrink', () => {
    render(<QuickActionRow chips={chipsOf(3)} />);
    for (const tag of within(scroller()).getAllByRole('button')) expect(tag).toHaveClass('shrink-0');
  });
});

describe('QuickActionRow accent', () => {
  const allGlyph = () => within(allTag()).getByTestId('quick-action-row-all-glyph');

  it("draws the All glyph in the tag's text colour with no accent", () => {
    render(<QuickActionRow chips={chipsOf(2)} />);
    expect(allGlyph().getAttribute('class')).toBe('');
    expect(allGlyph().innerHTML).toContain('fill="currentColor"');
  });

  it("tints the All glyph with a named accent's text class (OpenFrame's grey)", () => {
    render(<QuickActionRow chips={chipsOf(2)} accent="grey" />);
    expect(allGlyph().classList.contains('text-ods-text-panel-secondary')).toBe(true);
    expect(allGlyph().innerHTML).toContain('fill="currentColor"');
  });

  it('fills the All glyph with an admin-configured CSS colour', () => {
    render(<QuickActionRow chips={chipsOf(2)} accent="#123456" />);
    expect(allGlyph().innerHTML).toContain('fill="#123456"');
  });

  it.each([
    [undefined, {}],
    ['grey', { className: 'text-ods-text-panel-secondary' }],
    ['cyan', { className: 'text-ods-flamingo-cyan' }],
    ['#123456', { color: '#123456' }],
  ] as const)('tints a glyph for accent %s', (accent, tint) => {
    expect(quickActionAccentTint(accent)).toEqual(tint);
  });

  it("passes the accent through Mingo's wall and welcome", () => {
    const { unmount } = render(<MingoQuickActionWall quickActions={ACTIONS} accent="grey" />);
    expect(allGlyph().classList.contains('text-ods-text-panel-secondary')).toBe(true);
    unmount();
    render(<MingoWelcome quickActions={ACTIONS} quickActionAccent="grey" />);
    expect(allGlyph().classList.contains('text-ods-text-panel-secondary')).toBe(true);
  });
});

describe('QuickActionRow All follows the accent its chips share', () => {
  const allGlyph = () => within(allTag()).getByTestId('quick-action-row-all-glyph');
  const iconChips = (accents: ReadonlyArray<string | undefined>, props?: Record<string, unknown>) =>
    accents.map((accent, i) => ({
      id: `c-${i}`,
      label: `Action ${i}`,
      icon: { name: 'shield', accent, props },
      onSelect: vi.fn(),
    }));

  // The client chat: every chip carries the assistant's configured colour, or Fae pink.
  it("takes a named accent every chip shares (the client chat's Fae pink)", () => {
    render(<QuickActionRow chips={iconChips(['pink', 'pink', 'pink'])} />);
    expect(allGlyph().classList.contains('text-ods-flamingo-pink')).toBe(true);
  });

  it('takes an admin-configured CSS colour every chip shares', () => {
    render(<QuickActionRow chips={iconChips(['#ff7a00', '#ff7a00'])} />);
    expect(allGlyph().innerHTML).toContain('fill="#ff7a00"');
  });

  it('takes the row theme when the chips carry no accent of their own', () => {
    render(<QuickActionRow chips={iconChips([undefined, undefined])} theme={{ accent: 'cyan' }} />);
    expect(allGlyph().classList.contains('text-ods-flamingo-cyan')).toBe(true);
  });

  it('keeps the shared accent when one action fills its own icon (props.color is that chip alone)', () => {
    const chips = [...iconChips(['pink']), { ...iconChips(['pink'], { color: '#00ff00' })[0], id: 'own' }];
    render(<QuickActionRow chips={chips} />);
    expect(allGlyph().classList.contains('text-ods-flamingo-pink')).toBe(true);
  });

  it("keeps the tag's text colour when the chips' accents differ", () => {
    render(<QuickActionRow chips={iconChips(['pink', 'cyan'])} />);
    expect(allGlyph().getAttribute('class')).toBe('');
  });

  it('an explicit accent wins over the shared one (OpenFrame stays grey)', () => {
    render(<QuickActionRow chips={iconChips(['pink', 'pink'])} accent="grey" />);
    expect(allGlyph().classList.contains('text-ods-text-panel-secondary')).toBe(true);
    expect(allGlyph().classList.contains('text-ods-flamingo-pink')).toBe(false);
  });

  it.each([
    ['no chip has an icon', [{ id: 'a', label: 'A' }], undefined],
    ['a rendered icon it cannot read', [{ id: 'a', label: 'A', icon: <svg /> }], undefined],
    [
      'chips without an icon among them',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B', icon: { name: 'x', accent: 'pink' } },
      ],
      'pink',
    ],
  ] as const)('sharedChipAccent with %s', (_name, chips, expected) => {
    expect(sharedChipAccent(chips)).toBe(expected);
  });

  // The hub and every Guide-mode chat: the chips take the action's accent, else the identity colour, else cyan.
  it("follows Guide mode's chip accent (cyan by default, an identity colour when configured)", () => {
    const actions = [
      { id: 'g1', label: 'Pricing', iconName: 'shield' },
      { id: 'g2', label: 'Setup', iconName: 'code' },
    ];
    const { unmount } = render(<GuideWelcome quickActions={actions} />);
    expect(allGlyph().classList.contains('text-ods-flamingo-cyan')).toBe(true);
    unmount();
    render(<GuideWelcome quickActions={actions} icon={{ name: 'mingo', props: { color: '#7c3aed' } }} />);
    expect(allGlyph().innerHTML).toContain('fill="#7c3aed"');
  });
});

describe('QuickActionRow edge fades', () => {
  it('fades the right edge while more tags follow, the left one once it is scrolled', () => {
    rowWidths(1000, 300);
    render(<QuickActionRow chips={chipsOf(12)} />);
    expect(scroller()).toHaveAttribute('data-fade-right', 'true');
    expect(scroller()).not.toHaveAttribute('data-fade-left');

    scroller().scrollLeft = 200;
    fireEvent.scroll(scroller());
    expect(scroller()).toHaveAttribute('data-fade-left', 'true');
    expect(scroller()).toHaveAttribute('data-fade-right', 'true');

    scroller().scrollLeft = 700;
    fireEvent.scroll(scroller());
    expect(scroller()).not.toHaveAttribute('data-fade-right');
  });

  it('has no fade when every tag fits', () => {
    rowWidths(300, 300);
    render(<QuickActionRow chips={chipsOf(2)} />);
    expect(scroller()).not.toHaveAttribute('data-fade-left');
    expect(scroller()).not.toHaveAttribute('data-fade-right');
  });
});

describe('QuickActionRow mouse wheel', () => {
  const wheel = (init: WheelEventInit) => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
    scroller().dispatchEvent(event);
    return event;
  };

  it('scrolls the row sideways and keeps the page still while the row has somewhere to go', () => {
    rowWidths(1000, 300);
    render(<QuickActionRow chips={chipsOf(12)} />);
    const event = wheel({ deltaY: 120 });
    expect(scroller().scrollLeft).toBe(120);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves the wheel to the page when every tag fits, and at the end it is turned towards', () => {
    rowWidths(300, 300);
    const { unmount } = render(<QuickActionRow chips={chipsOf(2)} />);
    expect(wheel({ deltaY: 120 }).defaultPrevented).toBe(false);
    unmount();

    rowWidths(1000, 300);
    render(<QuickActionRow chips={chipsOf(12)} />);
    expect(wheel({ deltaY: -120 }).defaultPrevented).toBe(false);
    scroller().scrollLeft = 700;
    expect(wheel({ deltaY: 120 }).defaultPrevented).toBe(false);
  });

  it('leaves a sideways gesture alone', () => {
    rowWidths(1000, 300);
    render(<QuickActionRow chips={chipsOf(12)} />);
    expect(wheel({ deltaX: 120, deltaY: 10 }).defaultPrevented).toBe(false);
  });

  it('scrolls and fades a row whose actions arrive after it mounted with none', () => {
    rowWidths(1000, 300);
    const { rerender } = render(<QuickActionRow chips={[]} />);
    expect(screen.queryByTestId('quick-action-row-scroller')).toBeNull();

    rerender(<QuickActionRow chips={chipsOf(12)} />);
    expect(scroller()).toHaveAttribute('data-fade-right');
    const event = wheel({ deltaY: 120 });
    expect(scroller().scrollLeft).toBe(120);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('QuickActionRow All menu', () => {
  it('lists every action in the row order, the ones the row shows too', () => {
    wideWindow();
    render(<QuickActionRow chips={chipsOf(5)} />);
    openAllMenu();
    expect(screen.getAllByRole('menuitem').map(row => row.textContent)).toEqual([
      'Action 0',
      'Action 1',
      'Action 2',
      'Action 3',
      'Action 4',
    ]);
  });

  it('says it opens a menu and whether it is open', () => {
    wideWindow();
    render(<QuickActionRow chips={chipsOf(5)} />);
    expect(allTag()).toHaveAttribute('aria-haspopup', 'menu');
    expect(allTag()).toHaveAttribute('aria-expanded', 'false');
    openAllMenu();
    expect(allTag()).toHaveAttribute('aria-expanded', 'true');
  });

  it('picks an action from its row, once, as a tag is picked', () => {
    wideWindow();
    const chips = chipsOf(5);
    render(<QuickActionRow chips={chips} />);
    openAllMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Action 4' }));
    expect(chips[4].onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('previews an action from its row under the pointer, and stops when the pointer leaves', () => {
    wideWindow();
    const chips = chipsOf(3);
    render(<QuickActionRow chips={chips} />);
    openAllMenu();
    const row = screen.getByRole('menuitem', { name: 'Action 1' });
    fireEvent.mouseEnter(row);
    expect(chips[1].onHoverStart).toHaveBeenCalledTimes(1);
    fireEvent.mouseLeave(row);
    expect(chips[1].onHoverEnd).toHaveBeenCalledTimes(1);
  });

  it('previews nothing by opening: only a row the keyboard moves to', async () => {
    wideWindow();
    const chips = chipsOf(3);
    render(<QuickActionRow chips={chips} />);
    allTag().focus();
    fireEvent.keyDown(allTag(), { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Action 0' })).toHaveFocus());
    expect(chips[0].onHoverStart).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Action 1' })).toHaveFocus();
    expect(chips[1].onHoverStart).toHaveBeenCalledTimes(1);
  });

  it('moves between its rows with the arrow keys, wrapping at the ends', async () => {
    wideWindow();
    render(<QuickActionRow chips={chipsOf(3)} />);
    allTag().focus();
    fireEvent.keyDown(allTag(), { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Action 0' })).toHaveFocus());
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'End' });
    expect(screen.getByRole('menuitem', { name: 'Action 2' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Action 0' })).toHaveFocus();
  });
});

describe('QuickActionRow All menu: more rows than fit', () => {
  /** The scroller of the open menu's rows. */
  const menuRows = () => screen.getByTestId('actions-menu-rows');

  it('scrolls its rows inside the menu and fades the edge they continue past', () => {
    wideWindow();
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(410);
    render(<QuickActionRow chips={chipsOf(24)} />);
    openAllMenu();
    expect(screen.getAllByRole('menuitem')).toHaveLength(24);
    expect(menuRows()).toHaveAttribute('data-fade-bottom', 'true');
    expect(menuRows()).not.toHaveAttribute('data-fade-top');

    menuRows().scrollTop = 300;
    fireEvent.scroll(menuRows());
    expect(menuRows()).toHaveAttribute('data-fade-top', 'true');

    menuRows().scrollTop = 590;
    fireEvent.scroll(menuRows());
    expect(menuRows()).not.toHaveAttribute('data-fade-bottom');
  });

  it('has no fade when every row fits', () => {
    wideWindow();
    render(<QuickActionRow chips={chipsOf(3)} />);
    openAllMenu();
    expect(menuRows()).not.toHaveAttribute('data-fade-top');
    expect(menuRows()).not.toHaveAttribute('data-fade-bottom');
  });
});

describe('QuickActionRow focus after a pick from All', () => {
  it('stays where the host moved it (the composer), not back on the tag', async () => {
    wideWindow();
    const chips = chipsOf(2);
    chips[1].onSelect.mockImplementation(() => screen.getByRole('textbox', { name: 'Composer' }).focus());
    render(
      <>
        <QuickActionRow chips={chips} />
        <input aria-label="Composer" />
      </>,
    );
    openAllMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Action 1' }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(screen.getByRole('textbox', { name: 'Composer' })).toHaveFocus();
  });

  it('returns to the tag when the menu is closed without a pick', async () => {
    wideWindow();
    render(<QuickActionRow chips={chipsOf(2)} />);
    allTag().focus();
    fireEvent.keyDown(allTag(), { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Action 0' })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(allTag()).toHaveFocus();
  });
});

describe('QuickActionRow All sheet (a phone)', () => {
  it('opens every action in a sheet named after the row, and a pick sends it and closes the sheet', async () => {
    const chips = chipsOf(4);
    render(<QuickActionRow chips={chips} />);
    expect(allTag()).toHaveAttribute('aria-haspopup', 'dialog');
    fireEvent.click(allTag());
    const sheet = await screen.findByRole('dialog', { name: 'Quick actions' });
    expect(within(sheet).getAllByRole('menuitem')).toHaveLength(4);

    fireEvent.click(within(sheet).getByRole('menuitem', { name: 'Action 2' }));
    expect(chips[2].onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('QuickActionRow leading tags', () => {
  const guide = { id: 'guide', label: 'Start Guide Chat', onSelect: vi.fn() };

  it('draws them first, and leaves them out of the All list', () => {
    wideWindow();
    render(<QuickActionRow chips={chipsOf(2)} leading={[guide]} />);
    expect(within(scroller()).getAllByRole('button')[0]).toHaveTextContent('Start Guide Chat');
    openAllMenu();
    expect(screen.queryByRole('menuitem', { name: 'Start Guide Chat' })).toBeNull();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('shows them with no action at all, without All', () => {
    render(<QuickActionRow chips={[]} leading={[guide]} />);
    expect(screen.getByRole('button', { name: 'Start Guide Chat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'All quick actions' })).toBeNull();
  });
});

describe('QuickActionSet page topic', () => {
  it("prints the page's topic when the host turns the stamp on, loaded and loading alike", () => {
    const { rerender } = render(
      <PageTopicsProvider pathname="/devices" showTopic>
        <QuickActionSet chips={chipsOf(2)} />
      </PageTopicsProvider>,
    );
    expect(screen.getByText('/devices')).toBeTruthy();
    rerender(
      <PageTopicsProvider pathname="/devices" showTopic>
        <QuickActionSet chips={[]} loading />
      </PageTopicsProvider>,
    );
    expect(screen.getByText('/devices')).toBeTruthy();
  });

  it('prints nothing unless the host asks', () => {
    render(
      <PageTopicsProvider pathname="/devices">
        <QuickActionSet chips={chipsOf(2)} />
      </PageTopicsProvider>,
    );
    expect(screen.queryByText('/devices')).toBeNull();
  });

  it("is the same stamp on Mingo's set", () => {
    render(
      <PageTopicsProvider pathname="/scripts" showTopic>
        <MingoQuickActionWall quickActions={ACTIONS} />
      </PageTopicsProvider>,
    );
    expect(screen.getByText('/scripts')).toBeTruthy();
  });
});

describe('MingoQuickActionWall', () => {
  it('hands a clicked tag to its action', () => {
    render(<MingoQuickActionWall quickActions={ACTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Patching' }));
    expect(ACTIONS[0].onClick).toHaveBeenCalledTimes(1);
  });

  it('draws nothing without actions', () => {
    const { container } = render(<MingoQuickActionWall quickActions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("holds the row's place while the actions are read: its tags' loading form, no tag to press", () => {
    render(<MingoQuickActionWall quickActions={[]} loading />);
    expect(loadingTags()).toHaveLength(4);
    expect(screen.queryAllByRole('button', { name: 'Patching' })).toHaveLength(0);
  });

  it('holds its place in the welcome while the host reads the actions', () => {
    render(<MingoWelcome quickActions={[]} quickActionsLoading hasExistingChats={false} />);
    expect(loadingTags()).toHaveLength(4);
  });
});

describe('MingoWelcome "Start Guide Chat"', () => {
  it('is the first tag of the row and switches to Guide mode', () => {
    const onStartGuideChat = vi.fn();
    render(<MingoWelcome quickActions={ACTIONS} onStartGuideChat={onStartGuideChat} />);
    const tags = within(scroller()).getAllByRole('button');
    expect(tags.map(tag => tag.textContent)).toEqual(['Start Guide Chat', 'Patching', 'Disk Scan']);
    fireEvent.click(tags[0]);
    expect(onStartGuideChat).toHaveBeenCalledTimes(1);
  });

  it('is not an action: the All list leaves it out', () => {
    wideWindow();
    render(<MingoWelcome quickActions={ACTIONS} onStartGuideChat={vi.fn()} />);
    openAllMenu();
    expect(screen.getAllByRole('menuitem').map(row => row.textContent)).toEqual(['Patching', 'Disk Scan']);
  });

  it('is there with no action at all', () => {
    render(<MingoWelcome onStartGuideChat={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Start Guide Chat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'All quick actions' })).toBeNull();
  });
});
