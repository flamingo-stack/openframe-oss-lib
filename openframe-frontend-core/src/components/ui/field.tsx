'use client';

import { type ReactNode, useId } from 'react';
import { InfoHint } from './info-hint';
import { Label } from './label';

/**
 * Accessibility props handed to the control by the `Field` render-prop.
 * Spread them onto the input/select/textarea so the label, required flag and
 * error message are all announced.
 */
export interface FieldRenderProps {
  id: string;
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export interface FieldProps {
  label: string;
  /** Definition shown in a hover `InfoHint` next to the label. */
  hint?: ReactNode;
  required?: boolean;
  children: (props: FieldRenderProps) => ReactNode;
  error?: string | null;
  /**
   * Inline content after the label text — AI badges, confidence chips. Lives in
   * the LABEL ROW so fields that carry badges keep the same geometry as fields
   * that don't; a hand-rolled label row next to a `Field` is what makes two
   * columns' controls land at different heights.
   */
  labelExtras?: ReactNode;
  /**
   * Right-aligned content at the end of the label row — character counters,
   * shortcuts. Same rationale: a counter rendered as its own row under the
   * control gives that column an extra line and misaligns every sibling.
   */
  labelEnd?: ReactNode;
}

/**
 * One form field: label, optional hint, control, optional error.
 *
 * Labels are a single line (hints live in the hover InfoHint icon, never in
 * flow), so cells top-align naturally and controls land on the same baseline.
 * Do NOT reintroduce `h-full` + `mt-auto` here: in a grid row it stretches the
 * cell to the tallest sibling and shoves this cell's control down to align with
 * the bottom of the sibling's ERROR text, detaching it from its own label.
 *
 * The label is tied to its control with a generated id, so clicking the label
 * focuses the input and assistive tech announces the field by name. `children`
 * is a REQUIRED render function — `{(f) => <Input {...f} />}` — spread what it
 * gives you onto the control. A plain-node escape hatch would leave `htmlFor`
 * pointing at an id that exists on no element, which is worse than no
 * association at all (the label looks wired up and announces nothing), so the
 * type doesn't offer one.
 */
export function Field({ label, hint, required, children, error, labelExtras, labelEnd }: FieldProps) {
  const controlId = useId();
  const errorId = `${controlId}-error`;
  const renderProps: FieldRenderProps = {
    id: controlId,
    // A bare `*` draws a star and tells assistive tech nothing.
    ...(required ? { 'aria-required': true } : {}),
    ...(error ? { 'aria-invalid': true, 'aria-describedby': errorId } : {}),
  };
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={controlId}>
          {label}
          {required && ' *'}
        </Label>
        {hint && <InfoHint label={label}>{hint}</InfoHint>}
        {labelExtras}
        {labelEnd && <span className="ml-auto shrink-0">{labelEnd}</span>}
      </div>
      <div className="pt-[var(--spacing-system-xxs)]">{children(renderProps)}</div>
      {/* `role="alert"` + the id the control points at: a validation message
          rendered as plain text is never announced. */}
      {error && (
        <p id={errorId} role="alert" className="text-ods-error text-h6">
          {error}
        </p>
      )}
    </div>
  );
}
