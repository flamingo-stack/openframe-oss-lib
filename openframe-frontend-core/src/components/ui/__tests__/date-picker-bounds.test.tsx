import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { DatePicker, DatePickerInputSimple } from '../date-picker'

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
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

/** Local midnight, so no assertion straddles a day boundary. */
function day(year: number, month: number, date: number): Date {
  return new Date(year, month, date)
}

/**
 * The day cell for an ISO date, and the button inside it.
 *
 * Found through `data-day` rather than by role or text: v9 gives the cell the
 * ISO date and every day button the same accessible name shape ("Friday, June
 * 5th, 2026"), so a query by the day NUMBER matches the wrong month's outside
 * days as well. The calendar renders into a portal, hence `document`.
 */
function dayButton(iso: string): HTMLButtonElement {
  const cell = document.querySelector(`[data-day="${iso}"]`)
  expect(cell, `no day cell for ${iso}`).not.toBeNull()
  const button = cell?.querySelector('button')
  expect(button, `no day button for ${iso}`).not.toBeNull()
  return button as HTMLButtonElement
}

/** Opens the picker's popover — the trigger shows the current value. */
function openCalendar(): void {
  fireEvent.click(screen.getByRole('button', { name: /06\/15\/2026/ }))
}

describe('date picker bounds', () => {
  it('refuses a day before fromDate and still takes one after it', () => {
    const onChange = vi.fn()
    render(
      <DatePicker mode="single" value={day(2026, 5, 15)} onChange={onChange} fromDate={day(2026, 5, 10)} />
    )
    openCalendar()

    fireEvent.click(dayButton('2026-06-05'))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(dayButton('2026-06-20'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]?.getDate()).toBe(20)
  })

  it('refuses a day after toDate and still takes one before it', () => {
    const onChange = vi.fn()
    render(
      <DatePicker mode="single" value={day(2026, 5, 15)} onChange={onChange} toDate={day(2026, 5, 20)} />
    )
    openCalendar()

    fireEvent.click(dayButton('2026-06-25'))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(dayButton('2026-06-18'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('marks the out-of-range day disabled instead of removing it', () => {
    render(<DatePicker mode="single" value={day(2026, 5, 15)} fromDate={day(2026, 5, 10)} />)
    openCalendar()

    // The day keeps its place in the month grid — a calendar missing its first
    // week reads as broken, and the greyed cell is what shows the bound exists.
    expect(dayButton('2026-06-05')).toBeDisabled()
    expect(dayButton('2026-06-20')).not.toBeDisabled()
    expect(document.querySelector('[data-day="2026-06-05"]')).toHaveAttribute('data-disabled', 'true')
  })

  it('stops month navigation at the bound', () => {
    render(<DatePickerInputSimple value={day(2026, 5, 15)} fromDate={day(2026, 5, 10)} />)
    openCalendar()

    // June still holds selectable days, so it stays reachable — but there is
    // nothing to select before it.
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next month' })).not.toBeDisabled()
  })

  it('leaves navigation and selection unbounded when no bounds are given', () => {
    const onChange = vi.fn()
    render(<DatePicker mode="single" value={day(2026, 5, 15)} onChange={onChange} />)
    openCalendar()

    expect(screen.getByRole('button', { name: 'Previous month' })).not.toBeDisabled()
    fireEvent.click(dayButton('2026-06-01'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
