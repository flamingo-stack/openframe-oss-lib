/**
 * Pins where the panel hangs when the trigger is as wide as its column — a
 * table's filter header is `w-full` of a `flex-1` cell. The auto-placement once
 * measured the room past the trigger's FAR edge, so a wide trigger near the
 * row's end flipped `bottom-start` to `bottom-end` and the panel landed at the
 * far right, away from the label it belongs to. What has to fit is the panel's
 * own width from the edge it hangs off. And the room is the clipping container's: a table in a page column narrower
 * than the window (a side panel or a navigation rail beside it) has less of it than the window says.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type FilterSection, FiltersDropdown } from '../filters-dropdown';

const SECTIONS: FilterSection[] = [
  {
    id: 'status',
    title: 'Software Version',
    type: 'checkbox',
    options: [{ id: 'outdated', label: 'Outdated', value: 'outdated' }],
  },
];

const VIEWPORT_WIDTH = 1900;

function mockTriggerRect(left: number, right: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left,
    right,
    top: 0,
    bottom: 48,
    width: right - left,
    height: 48,
    x: left,
    y: 0,
    toJSON: () => ({}),
  });
}

function openAndReadPanel(placement: 'bottom-start' | 'bottom-end') {
  render(
    <FiltersDropdown
      triggerElement={<div className="w-full">Software Version</div>}
      sections={SECTIONS}
      onApply={() => {}}
      placement={placement}
      className="!block w-full"
    />,
  );
  fireEvent.click(screen.getByText('Software Version'));
  // Apply sits in the panel's own tree; the panel is the closest absolutely
  // positioned element, which is where the placement class lands.
  const panel = screen.getByRole('button', { name: 'Apply' }).closest('.absolute');
  if (!panel) throw new Error('the panel did not open');
  return panel;
}

describe('FiltersDropdown auto-placement', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_WIDTH, configurable: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps bottom-start under a column-wide trigger whose far edge is near the viewport edge', () => {
    // The trigger spans 900–1800 of 1900: 100px past its right edge, but the
    // panel hangs off its LEFT edge, where there is 1000px.
    mockTriggerRect(900, 1800);
    const panel = openAndReadPanel('bottom-start');
    expect(panel.classList.contains('left-0')).toBe(true);
    expect(panel.classList.contains('right-0')).toBe(false);
  });

  it('flips bottom-start to bottom-end only when the panel would not fit from the left edge', () => {
    // 1700 + 320 overshoots 1900; from the right edge it fits.
    mockTriggerRect(1700, 1800);
    const panel = openAndReadPanel('bottom-start');
    expect(panel.classList.contains('right-0')).toBe(true);
  });

  it('flips bottom-end to bottom-start only when the panel would not fit from the right edge', () => {
    // 100 − 320 falls off the left; from the left edge it fits.
    mockTriggerRect(20, 100);
    const panel = openAndReadPanel('bottom-end');
    expect(panel.classList.contains('left-0')).toBe(true);
  });
});

describe('FiltersDropdown auto-placement inside a clipping container', () => {
  const COLUMN = { left: 600, right: 1500 };

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_WIDTH, configurable: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function rect(left: number, right: number): DOMRect {
    return { left, right, top: 0, bottom: 48, width: right - left, height: 48, x: left, y: 0, toJSON: () => ({}) };
  }

  /** The page column clips (`overflow-x: auto`) and ends at 1500; the trigger is the column's last header cell. */
  function openInColumn(triggerLeft: number, triggerRight: number) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.dataset.column ? rect(COLUMN.left, COLUMN.right) : rect(triggerLeft, triggerRight);
    });
    render(
      <div data-column="page" style={{ overflowX: 'auto' }}>
        <FiltersDropdown
          triggerElement={<div className="w-full">Auto-update</div>}
          sections={SECTIONS}
          onApply={() => {}}
          className="!block w-full"
        />
      </div>,
    );
    fireEvent.click(screen.getByText('Auto-update'));
    const panel = screen.getByRole('button', { name: 'Apply' }).closest('.absolute');
    if (!panel) throw new Error('the panel did not open');
    return panel;
  }

  it('flips to bottom-end when the panel would run past the column, though the window has room', () => {
    // 1300 + 320 = 1620: inside the 1900px window, past the column's 1500.
    const panel = openInColumn(1300, 1450);
    expect(panel.classList.contains('right-0')).toBe(true);
  });

  it('keeps bottom-start when the panel fits in the column', () => {
    const panel = openInColumn(700, 900);
    expect(panel.classList.contains('left-0')).toBe(true);
  });
});
