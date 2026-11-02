import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageTopicsProvider } from '../../../contexts/page-topics-context';
import { MingoQuickActionWall, QUICK_ACTION_SET_SLOTS, QuickActionSet } from '../mingo-quick-action-wall';
import { MingoWelcome } from '../mingo-welcome';

const ACTIONS = [
  { id: 'qa-1', label: 'Patching', prompt: 'Check my fleet for pending patches.', onClick: vi.fn() },
  { id: 'qa-2', label: 'Disk Scan', prompt: 'Run a quick disk scan.', onClick: vi.fn() },
];

const chipsOf = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `c-${i}`, label: `Action ${i}`, onSelect: vi.fn() }));

/** The set's slots, whatever each one holds. */
const slots = () => screen.queryAllByTestId('quick-action-slot');

describe('QuickActionSet', () => {
  it.each([0, 1, 3, QUICK_ACTION_SET_SLOTS, QUICK_ACTION_SET_SLOTS + 1, 40])(
    'holds the same slots with %i actions',
    count => {
      render(<QuickActionSet chips={chipsOf(count)} />);
      expect(slots()).toHaveLength(QUICK_ACTION_SET_SLOTS);
    },
  );

  it('holds the same slots while the actions are read, each its chip’s loading form', () => {
    render(<QuickActionSet chips={[]} loading />);
    expect(slots()).toHaveLength(QUICK_ACTION_SET_SLOTS);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps unused slots in place, unseen and out of the accessibility tree', () => {
    render(<QuickActionSet chips={chipsOf(1)} />);
    const [used, ...unused] = slots();
    expect(used).not.toHaveClass('invisible');
    expect(unused).toHaveLength(QUICK_ACTION_SET_SLOTS - 1);
    for (const slot of unused) {
      expect(slot).toHaveClass('invisible');
      expect(slot).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('shows every action when they fit, and no More', () => {
    render(<QuickActionSet chips={chipsOf(QUICK_ACTION_SET_SLOTS)} />);
    expect(screen.getAllByRole('button')).toHaveLength(QUICK_ACTION_SET_SLOTS);
    expect(screen.queryByRole('button', { name: /More quick actions/ })).toBeNull();
  });

  it('turns the last slot into More with the count of the rest', () => {
    render(<QuickActionSet chips={chipsOf(10)} />);
    expect(screen.getByRole('button', { name: 'More quick actions (7)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Action 2' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Action 3' })).toBeNull();
  });

  it('is one labelled group of buttons', () => {
    render(<QuickActionSet chips={chipsOf(2)} label="Suggested questions" />);
    expect(screen.getByRole('group', { name: 'Suggested questions' })).toBeTruthy();
  });
});

describe('QuickActionSet More menu', () => {
  const openMore = (count: number) => {
    fireEvent.pointerDown(screen.getByRole('button', { name: `More quick actions (${count})` }), {
      button: 0,
      pointerType: 'mouse',
    });
  };

  it('picks a hidden action from its row, as a shown chip is picked', () => {
    const chips = chipsOf(5);
    render(<QuickActionSet chips={chips} />);
    openMore(2);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Action 4' }));
    expect(chips[4].onSelect).toHaveBeenCalledTimes(1);
  });

  it('says it opens a menu and whether it is open', () => {
    render(<QuickActionSet chips={chipsOf(5)} />);
    const more = screen.getByRole('button', { name: 'More quick actions (2)' });
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    openMore(2);
    expect(more).toHaveAttribute('aria-expanded', 'true');
  });

  it('moves focus to the first row when it opens', async () => {
    render(<QuickActionSet chips={chipsOf(5)} />);
    const more = screen.getByRole('button', { name: 'More quick actions (2)' });
    more.focus();
    fireEvent.keyDown(more, { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Action 3' })).toHaveFocus());
  });

  it('moves between its rows with the arrow keys, wrapping at the ends', async () => {
    render(<QuickActionSet chips={chipsOf(6)} />);
    const more = screen.getByRole('button', { name: 'More quick actions (3)' });
    more.focus();
    fireEvent.keyDown(more, { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Action 3' })).toHaveFocus());
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Action 4' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(screen.getByRole('menuitem', { name: 'Action 5' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Action 3' })).toHaveFocus();
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
  it('hands a clicked chip to its action', () => {
    render(<MingoQuickActionWall quickActions={ACTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Patching' }));
    expect(ACTIONS[0].onClick).toHaveBeenCalledTimes(1);
  });

  it('draws nothing without actions', () => {
    const { container } = render(<MingoQuickActionWall quickActions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("holds the set's place while the actions are read: its chips' loading form, no chip to press", () => {
    render(<MingoQuickActionWall quickActions={[]} loading />);
    expect(slots()).toHaveLength(QUICK_ACTION_SET_SLOTS);
    expect(screen.queryAllByRole('button', { name: 'Patching' })).toHaveLength(0);
  });

  it('is the set the welcome draws', () => {
    const { container: welcome } = render(<MingoWelcome quickActions={ACTIONS} hasExistingChats={false} />);
    const { container: wall } = render(<MingoQuickActionWall quickActions={ACTIONS} />);
    expect(welcome.innerHTML).toContain(wall.innerHTML);
  });

  it('holds its slots in the welcome while the host reads the actions', () => {
    render(<MingoWelcome quickActions={[]} quickActionsLoading hasExistingChats={false} />);
    expect(slots()).toHaveLength(QUICK_ACTION_SET_SLOTS);
  });
});
