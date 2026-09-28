import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DatePicker, DatePickerInputSimple } from '../date-picker';

/**
 * `fromDate` / `toDate` are the pickers' only bounds, and they have already been
 * dropped silently once: react-day-picker **v9** removed the props of those
 * names, so the calendar kept forwarding two values the library no longer read
 * and every consumer's minimum/maximum quietly stopped applying. Nothing failed
 * — the picker simply accepted any date — which is exactly the kind of
 * regression a type check cannot see and a test has to.
 *
 * Each case asserts BOTH halves of a bound: the out-of-range day is refused and
 * an in-range one is still accepted. A matcher that disabled the whole month
 * would satisfy the first assertion on its own.
 */

beforeAll(() => {
  // jsdom ships no matchMedia; the calendar reads `useMdUp` to decide how many
  // months to show. "No match" pins it to the single-month layout these
  // assertions are written against.
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
});

/** `DatePicker`'s `onChange` in `mode="single"` — the contract the mocks stand in for. */
type SingleDateChange = (date: Date | undefined) => void;

/** Local midnight, so no assertion straddles a day boundary. */
function day(year: number, month: number, date: number): Date {
  return new Date(year, month, date);
}

/**
 * The day cell for an ISO date.
 *
 * Picked out of the grid cells by `data-day` rather than by accessible name:
 * v9 gives every day button the same name SHAPE ("Friday, June 5th, 2026"),
 * which is locale- and version-dependent, and a query by the day NUMBER also
 * matches the neighbouring months' outside days.
 */
function dayCell(iso: string): HTMLElement {
  const cell = screen.getAllByRole('gridcell').find(c => c.getAttribute('data-day') === iso);
  expect(cell, `no day cell for ${iso}`).toBeDefined();
  return cell as HTMLElement;
}

/** The day button inside that cell — what a user actually clicks. */
function dayButton(iso: string): HTMLElement {
  return within(dayCell(iso)).getByRole('button');
}

/** Opens the picker's popover — the trigger shows the current value. */
function openCalendar(): void {
  fireEvent.click(screen.getByRole('button', { name: /06\/15\/2026/ }));
}

describe('date picker bounds', () => {
  it('refuses a day before fromDate and still takes one after it', () => {
    // Typed to the prop it stands in for, so `mock.calls[0][0]` is the `Date |
    // undefined` the picker actually hands back rather than an `any`.
    const onChange = vi.fn<SingleDateChange>();
    render(<DatePicker mode="single" value={day(2026, 5, 15)} onChange={onChange} fromDate={day(2026, 5, 10)} />);
    openCalendar();

    fireEvent.click(dayButton('2026-06-05'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(dayButton('2026-06-20'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]?.getDate()).toBe(20);
  });

  it('refuses a day after toDate and still takes one before it', () => {
    // Typed to the prop it stands in for, so `mock.calls[0][0]` is the `Date |
    // undefined` the picker actually hands back rather than an `any`.
    const onChange = vi.fn<SingleDateChange>();
    render(<DatePicker mode="single" value={day(2026, 5, 15)} onChange={onChange} toDate={day(2026, 5, 20)} />);
    openCalendar();

    fireEvent.click(dayButton('2026-06-25'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(dayButton('2026-06-18'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('marks the out-of-range day disabled instead of removing it', () => {
    render(<DatePicker mode="single" value={day(2026, 5, 15)} fromDate={day(2026, 5, 10)} />);
    openCalendar();

    // The day keeps its place in the month grid — a calendar missing its first
    // week reads as broken, and the greyed cell is what shows the bound exists.
    expect(dayButton('2026-06-05')).toBeDisabled();
    expect(dayButton('2026-06-20')).not.toBeDisabled();
    expect(dayCell('2026-06-05')).toHaveAttribute('data-disabled', 'true');
  });

  it('stops month navigation at the bound', () => {
    render(<DatePickerInputSimple value={day(2026, 5, 15)} fromDate={day(2026, 5, 10)} />);
    openCalendar();

    // June still holds selectable days, so it stays reachable — but there is
    // nothing to select before it.
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next month' })).not.toBeDisabled();
  });

  it('leaves navigation and selection unbounded when no bounds are given', () => {
    // Typed to the prop it stands in for, so `mock.calls[0][0]` is the `Date |
    // undefined` the picker actually hands back rather than an `any`.
    const onChange = vi.fn<SingleDateChange>();
    render(<DatePicker mode="single" value={day(2026, 5, 15)} onChange={onChange} />);
    openCalendar();

    expect(screen.getByRole('button', { name: 'Previous month' })).not.toBeDisabled();
    fireEvent.click(dayButton('2026-06-01'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
