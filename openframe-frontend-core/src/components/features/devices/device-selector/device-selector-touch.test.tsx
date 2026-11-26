import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_SELECTOR, IdleIntersectionObserver } from '../../feature-tables.fixtures';
import type { DeviceRow } from '../types';
import { DeviceSelector } from './device-selector';
import type { DeviceSelectorProps } from './device-selector.types';

/**
 * The grid picker's add / remove button on a touch screen (CU-17tkuw69fv1): its column is pinned right while the
 * Device column scrolls away, and a finger opens no tooltip, so the first tap shows the tooltip ("Add <device>") and
 * applies nothing; a second tap on the same button applies. A mouse, a pen and the keyboard apply at once.
 */

/** The clock the two-step tap reads (`Date.now()`), moved by hand. */
let now = 0;
function wait(ms: number) {
  now += ms;
}
/** Longer than the guard against a double tap's second click (350 ms). */
const CONFIRM_DELAY = 400;

/** The element a tooltip listens on: `FloatingTooltip`'s trigger wrapper around the control. */
function trigger(control: HTMLElement): HTMLElement {
  return control.parentElement as HTMLElement;
}

/**
 * A finger's tap as older WebKit sends it: `pointerdown` (touch), the compatibility `mouseenter`, then a click that is
 * a plain MouseEvent with no `pointerType`.
 */
function tap(control: HTMLElement) {
  fireEvent.pointerEnter(trigger(control), { pointerType: 'touch' });
  fireEvent.pointerDown(control, { pointerType: 'touch' });
  fireEvent.mouseEnter(trigger(control));
  fireEvent.click(control, { detail: 1 });
}

/** A finger's tap as Chrome sends it: the click itself is a PointerEvent that says `touch`; no `pointerdown` read. */
function pointerEventTap(control: HTMLElement) {
  fireEvent(control, new PointerEvent('click', { bubbles: true, cancelable: true, detail: 1, pointerType: 'touch' }));
}

function mouseClick(control: HTMLElement) {
  fireEvent.pointerDown(control, { pointerType: 'mouse' });
  fireEvent.click(control, { detail: 1 });
}

function addButton(name: string) {
  return screen.getByRole('button', { name: `Add ${name}` });
}

/** What the picker's polite live region says (the infinite footer has a status region of its own). */
function liveText() {
  return screen.getAllByRole('status').find(region => region.tagName === 'P')?.textContent;
}

/** The picker holding its own selection, as a host's form does; every change is also reported to `onChange`. */
function Picker({ onChange, ...props }: Partial<DeviceSelectorProps> & { onChange?: (ids: Set<string>) => void }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  return (
    <DeviceSelector
      {...DEVICE_SELECTOR.loaded}
      layout="grid"
      selectedIds={selectedIds}
      onSelectionChange={ids => {
        setSelectedIds(ids);
        onChange?.(ids);
      }}
      {...props}
    />
  );
}

describe('DeviceSelector grid, two-step tap', () => {
  beforeAll(() => vi.stubGlobal('IntersectionObserver', IdleIntersectionObserver));
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => {
    now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => vi.restoreAllMocks());

  it('names the device on the first tap and applies nothing; the second tap applies it once', () => {
    const onChange = vi.fn<(ids: Set<string>) => void>();
    render(<Picker onChange={onChange} />);

    tap(addButton('reception-01'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Add reception-01');
    expect(onChange).not.toHaveBeenCalled();

    wait(CONFIRM_DELAY);
    tap(addButton('reception-01'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect([...onChange.mock.calls[0][0]]).toEqual(['m-1']);
    // Applied and done: the bubble does not stay open from the tap's compatibility mouseenter.
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove reception-01' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ignores a second tap within 350 ms of the first (a double tap), and applies the next one', () => {
    const onChange = vi.fn<(ids: Set<string>) => void>();
    render(<Picker onChange={onChange} />);

    tap(addButton('reception-01'));
    wait(100);
    tap(addButton('reception-01'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Add reception-01');

    wait(CONFIRM_DELAY);
    tap(addButton('reception-01'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('takes two steps when the click itself says touch, with no pointerdown before it', () => {
    const onChange = vi.fn<(ids: Set<string>) => void>();
    render(<Picker onChange={onChange} />);

    pointerEventTap(addButton('reception-01'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Add reception-01');

    wait(CONFIRM_DELAY);
    pointerEventTap(addButton('reception-01'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('applies a mouse click at once', () => {
    const onChange = vi.fn<(ids: Set<string>) => void>();
    render(<Picker onChange={onChange} />);
    mouseClick(addButton('reception-01'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('applies the keyboard at once, even after a touch that never became a click', () => {
    const onChange = vi.fn<(ids: Set<string>) => void>();
    render(<Picker onChange={onChange} />);
    const add = addButton('reception-01');
    // A finger that went down and scrolled away: its pointer type must not make the next keypress a tap.
    fireEvent.pointerDown(add, { pointerType: 'touch' });
    // Enter or Space on a button: the browser's click, with `detail` 0.
    fireEvent.click(add, { detail: 0 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not let a cancelled touch make the next plain click a tap', () => {
    const onChange = vi.fn<(ids: Set<string>) => void>();
    render(<Picker onChange={onChange} />);
    const add = addButton('reception-01');
    // A finger that went down and turned into a scroll: the browser cancels the pointer, no click follows.
    fireEvent.pointerDown(add, { pointerType: 'touch' });
    fireEvent.pointerCancel(add, { pointerType: 'touch' });
    // A later click whose press was not seen, sent as a plain MouseEvent with no `pointerType`.
    fireEvent.click(add, { detail: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not let a touch from long ago make the next plain click a tap', () => {
    const onChange = vi.fn<(ids: Set<string>) => void>();
    render(<Picker onChange={onChange} />);
    const add = addButton('reception-01');
    fireEvent.pointerDown(add, { pointerType: 'touch' });
    wait(1500);
    fireEvent.click(add, { detail: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the desktop hover tooltip, on a row that is not armed too', () => {
    render(<Picker />);
    // A mouse hover, nothing armed.
    fireEvent.pointerEnter(trigger(addButton('maya-mba')), { pointerType: 'mouse' });
    fireEvent.mouseEnter(trigger(addButton('maya-mba')));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Add maya-mba');
    fireEvent.mouseLeave(trigger(addButton('maya-mba')));

    // One row armed by a finger, then a mouse over another: the hover opens there and the armed bubble goes.
    tap(addButton('reception-01'));
    fireEvent.pointerEnter(trigger(addButton('maya-mba')), { pointerType: 'mouse' });
    fireEvent.mouseEnter(trigger(addButton('maya-mba')));
    const tooltips = screen.getAllByRole('tooltip');
    expect(tooltips).toHaveLength(1);
    expect(tooltips[0]).toHaveTextContent('Add maya-mba');
  });

  it('moves the bubble to another row on a tap there, applying nothing', () => {
    const onChange = vi.fn<(ids: Set<string>) => void>();
    render(<Picker onChange={onChange} />);

    tap(addButton('reception-01'));
    wait(CONFIRM_DELAY);
    tap(addButton('maya-mba'));
    const tooltips = screen.getAllByRole('tooltip');
    expect(tooltips).toHaveLength(1);
    expect(tooltips[0]).toHaveTextContent('Add maya-mba');
    expect(onChange).not.toHaveBeenCalled();

    // The first row is back to step one.
    wait(CONFIRM_DELAY);
    tap(addButton('reception-01'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Add reception-01');
  });

  it('points the armed button at its bubble and says what the second tap does', () => {
    render(<Picker />);
    const add = addButton('reception-01');
    expect(liveText()).toBe('');
    expect(add).not.toHaveAttribute('aria-describedby');

    tap(add);
    expect(add).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
    expect(liveText()).toBe('Tap again to add reception-01');

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(add).not.toHaveAttribute('aria-describedby');
    expect(liveText()).toBe('');
  });

  it('says "remove" for the Selected tab’s trash, and removes on the second tap', () => {
    const onChange = vi.fn<(ids: Set<string>) => void>();
    render(<Picker onChange={onChange} />);
    mouseClick(addButton('reception-01'));
    onChange.mockClear();
    fireEvent.click(screen.getByText(/Selected Devices/));

    const remove = screen.getByRole('button', { name: 'Remove reception-01' });
    tap(remove);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Remove reception-01');
    expect(liveText()).toBe('Tap again to remove reception-01');
    expect(onChange).not.toHaveBeenCalled();

    wait(CONFIRM_DELAY);
    tap(remove);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect([...onChange.mock.calls[0][0]]).toEqual([]);
  });

  it('shows a disabled row’s reason on a tap, with nothing to confirm', () => {
    const onChange = vi.fn<(ids: Set<string>) => void>();
    render(
      <Picker
        onChange={onChange}
        isDeviceDisabled={device => (device.id === 'd-2' ? 'Already in this policy' : undefined)}
      />,
    );
    const blocked = screen.getByLabelText('Add maya-mba: Already in this policy');

    tap(blocked);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Add maya-mba: Already in this policy');
    expect(liveText()).toBe('');

    wait(CONFIRM_DELAY);
    tap(blocked);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Add maya-mba: Already in this policy');
  });

  describe('clears the armed button without applying', () => {
    type OnChange = ReturnType<typeof vi.fn<(ids: Set<string>) => void>>;

    /** Arms reception-01 by a finger's first tap. */
    function arm() {
      tap(addButton('reception-01'));
      expect(screen.getByRole('tooltip')).toHaveTextContent('Add reception-01');
    }

    /** Nothing is armed any more, and nothing was applied. */
    function assertCleared(onChange: OnChange) {
      expect(screen.queryByRole('tooltip')).toBeNull();
      expect(liveText()).toBe('');
      expect(onChange).not.toHaveBeenCalled();
    }

    it('on a tap outside', () => {
      const onChange = vi.fn<(ids: Set<string>) => void>();
      render(<Picker onChange={onChange} />);
      arm();
      fireEvent.pointerDown(document.body, { pointerType: 'touch' });
      assertCleared(onChange);
    });

    it('on Escape', () => {
      const onChange = vi.fn<(ids: Set<string>) => void>();
      render(<Picker onChange={onChange} />);
      arm();
      fireEvent.keyDown(document.body, { key: 'Escape' });
      assertCleared(onChange);
    });

    it('on a tab switch', () => {
      const onChange = vi.fn<(ids: Set<string>) => void>();
      render(<Picker onChange={onChange} />);
      arm();
      fireEvent.click(screen.getByText(/Selected Devices/));
      fireEvent.click(screen.getByText('Available Devices'));
      assertCleared(onChange);
    });

    it('on a search change', () => {
      const onChange = vi.fn<(ids: Set<string>) => void>();
      render(<Picker onChange={onChange} />);
      arm();
      // A search that still lists the row: the change itself clears it.
      fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: 'reception' } });
      assertCleared(onChange);
    });

    it('on a page change', () => {
      const observers: Array<(entries: Array<Partial<IntersectionObserverEntry>>) => void> = [];
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(callback: (entries: Array<Partial<IntersectionObserverEntry>>) => void) {
            observers.push(callback);
          }
          observe() {}
          unobserve() {}
          disconnect() {}
          takeRecords() {
            return [];
          }
        },
      );
      const onChange = vi.fn<(ids: Set<string>) => void>();
      const onLoadMore = vi.fn();
      render(
        <Picker
          onChange={onChange}
          infiniteScroll={{ hasNextPage: true, isFetchingNextPage: false, onLoadMore, skeletonRows: 2 }}
        />,
      );
      arm();
      act(() => {
        for (const observe of observers) observe([{ isIntersecting: true }]);
      });
      expect(onLoadMore).toHaveBeenCalled();
      assertCleared(onChange);
      vi.stubGlobal('IntersectionObserver', IdleIntersectionObserver);
    });

    it('on Add All', () => {
      const onChange = vi.fn<(ids: Set<string>) => void>();
      render(<Picker onChange={onChange} />);
      arm();
      fireEvent.click(screen.getByRole('button', { name: 'Add All Devices' }));
      expect(onChange).toHaveBeenCalledTimes(1);
      onChange.mockClear();
      assertCleared(onChange);
    });

    it('on Remove N', () => {
      const onChange = vi.fn<(ids: Set<string>) => void>();
      render(<Picker onChange={onChange} />);
      mouseClick(addButton('reception-01'));
      mouseClick(addButton('maya-mba'));
      fireEvent.click(screen.getByText(/Selected Devices/));
      onChange.mockClear();

      tap(screen.getByRole('button', { name: 'Remove reception-01' }));
      expect(screen.getByRole('tooltip')).toHaveTextContent('Remove reception-01');
      fireEvent.click(screen.getByRole('button', { name: 'Remove 2 Devices' }));
      expect(screen.queryByRole('tooltip')).toBeNull();
      expect(liveText()).toBe('');
    });

    it('when the armed row leaves the list, and does not come back with it', () => {
      const onChange = vi.fn<(ids: Set<string>) => void>();
      const devices = DEVICE_SELECTOR.loaded.devices;
      const { rerender } = render(<Picker onChange={onChange} devices={devices} />);
      arm();

      rerender(<Picker onChange={onChange} devices={devices.filter((device: DeviceRow) => device.id !== 'd-1')} />);
      assertCleared(onChange);
      rerender(<Picker onChange={onChange} devices={devices} />);
      assertCleared(onChange);
    });

    it('on a criteria change', () => {
      const onChange = vi.fn<(ids: Set<string>) => void>();
      const onSelectionModeChange = vi.fn();
      const { rerender } = render(
        <Picker
          onChange={onChange}
          showSelectionModeRadio
          selectionMode="specific"
          onSelectionModeChange={onSelectionModeChange}
        />,
      );
      arm();
      fireEvent.click(screen.getByRole('radio', { name: /criteria/i }));
      expect(onSelectionModeChange).toHaveBeenCalledWith('criteria');
      rerender(
        <Picker
          onChange={onChange}
          showSelectionModeRadio
          selectionMode="criteria"
          onSelectionModeChange={onSelectionModeChange}
        />,
      );
      rerender(
        <Picker
          onChange={onChange}
          showSelectionModeRadio
          selectionMode="specific"
          onSelectionModeChange={onSelectionModeChange}
        />,
      );
      assertCleared(onChange);
    });
  });
});
