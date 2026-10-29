/**
 * Pins where the panel hangs when the trigger is as wide as its column — a
 * table's filter header is `w-full` of a `flex-1` cell. The auto-placement once
 * measured the room past the trigger's FAR edge, so a wide trigger near the
 * row's end flipped `bottom-start` to `bottom-end` and the panel landed at the
 * far right, away from the label it belongs to. What has to fit is the panel's
 * own width from the edge it hangs off.
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
