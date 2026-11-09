import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DatePicker, DatePickerInput, DatePickerInputSimple } from './date-picker';

/** A picker's label names its trigger, so a click on it opens the calendar and assistive tech reads the field's name. */
describe('date picker labels', () => {
  it('lets a label outside the picker name its trigger', () => {
    render(
      <>
        <label htmlFor="leaving-date">Leaving date</label>
        <DatePicker mode="single" id="leaving-date" />
      </>,
    );
    expect(screen.getByLabelText('Leaving date').tagName).toBe('BUTTON');
  });

  it.each([
    ['DatePicker', <DatePicker key="a" mode="single" id="d" label="Start date" />],
    ['DatePickerInput', <DatePickerInput key="b" id="d" label="Start date" />],
    ['DatePickerInputSimple', <DatePickerInputSimple key="c" id="d" label="Start date" />],
  ])('ties its own label to the trigger (%s)', (_, picker) => {
    render(picker);
    expect(screen.getByLabelText('Start date').tagName).toBe('BUTTON');
  });

  // The label is now the trigger's whole name, so the date it shows reaches assistive tech as its description.
  it.each([
    ['DatePicker', <DatePicker key="a" mode="single" id="d" label="Start date" value={new Date(2026, 10, 5)} />],
    ['DatePickerInput', <DatePickerInput key="b" id="d" label="Start date" value={new Date(2026, 10, 5)} />],
    [
      'DatePickerInputSimple',
      <DatePickerInputSimple key="c" id="d" label="Start date" value={new Date(2026, 10, 5)} />,
    ],
  ])('describes the trigger by the date it shows (%s)', (_, picker) => {
    render(picker);
    expect(screen.getByLabelText('Start date')).toHaveAccessibleDescription(/2026/);
  });
});
