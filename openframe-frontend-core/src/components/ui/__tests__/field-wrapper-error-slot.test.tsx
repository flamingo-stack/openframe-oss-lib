import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScheduleIntervalInput } from '../../features/scripts/schedule-form/schedule-interval-input';
import { FieldWrapper } from '../field-wrapper';
import { Input } from '../input';
import { Select, SelectTrigger, SelectValue } from '../select';
import { Textarea } from '../textarea';

/**
 * A label-less FieldWrapper is `display: contents` until `error` is set and a
 * box afterwards, and the parent's spacing lands on the box but not on
 * `contents` — so the control jumped by that spacing whenever a message came
 * or went. `errorSlot` renders the box from the first render, and the controls
 * derive it from whether the caller wrote an `error` attribute at all. These
 * pin both halves: the flag, and each control's wiring of it.
 *
 * The wrapper is a role-less <div> and its display mode IS the contract, so
 * the tests walk up from the control (this file is listed in eslint.config.mjs).
 */

const BOX = 'relative';
const TRANSPARENT = 'contents';

const wrapperOf = (control: Element | null) => control?.parentElement ?? null;
const inputWrapper = () => wrapperOf(screen.getByLabelText('Name').closest('label'));

describe('FieldWrapper errorSlot', () => {
  it('stays layout-transparent without a label, a message or a slot', () => {
    render(
      <FieldWrapper>
        <input aria-label="n" />
      </FieldWrapper>,
    );
    expect(wrapperOf(screen.getByLabelText('n'))).toHaveClass(TRANSPARENT);
  });

  it('is a box from the first render when the slot is reserved, and stays one', () => {
    const { rerender } = render(
      <FieldWrapper errorSlot>
        <input aria-label="n" />
      </FieldWrapper>,
    );
    expect(wrapperOf(screen.getByLabelText('n'))).toHaveClass(BOX);
    rerender(
      <FieldWrapper errorSlot error="Required">
        <input aria-label="n" />
      </FieldWrapper>,
    );
    expect(wrapperOf(screen.getByLabelText('n'))).toHaveClass(BOX);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});

describe('the controls reserve the slot when an error attribute is written', () => {
  it('Input without the attribute stays transparent', () => {
    render(<Input aria-label="Name" />);
    expect(inputWrapper()).toHaveClass(TRANSPARENT);
  });

  it('Input with error={undefined} is a box before any message, and stays one', () => {
    const { rerender } = render(<Input aria-label="Name" error={undefined} />);
    expect(inputWrapper()).toHaveClass(BOX);
    rerender(<Input aria-label="Name" error="Required" />);
    expect(inputWrapper()).toHaveClass(BOX);
  });

  it('SelectTrigger with error={undefined} is a box before any message', () => {
    render(
      <Select>
        <SelectTrigger aria-label="Shell" error={undefined}>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
      </Select>,
    );
    expect(wrapperOf(screen.getByRole('combobox'))).toHaveClass(BOX);
  });

  it('Textarea with error={undefined} is a box before any message', () => {
    render(<Textarea aria-label="Notes" error={undefined} />);
    expect(wrapperOf(screen.getByLabelText('Notes'))).toHaveClass(BOX);
  });
});

/**
 * A wrapper that forwards `error={error}` unconditionally writes the attribute
 * for every caller, so the slot appears even where the caller never wired one.
 * In a flex row that full-width box takes the width of the control beside it:
 * the schedule form's "Stop Retry after" pair squeezed its unit select to
 * nothing and halved the box's height.
 */
describe('ScheduleIntervalInput forwards the slot only when its caller wires one', () => {
  const noop = () => {};

  it('stays transparent without an error attribute (Stop Retry after)', () => {
    render(<ScheduleIntervalInput aria-label="Name" value={30} onChange={noop} />);
    expect(inputWrapper()).toHaveClass(TRANSPARENT);
  });

  it('is a box with error={undefined} (Repeat in)', () => {
    render(<ScheduleIntervalInput aria-label="Name" value={30} onChange={noop} error={undefined} />);
    expect(inputWrapper()).toHaveClass(BOX);
  });
});
