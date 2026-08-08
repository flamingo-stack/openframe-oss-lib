'use client'

import * as React from 'react'
import { Label } from './label'
import { InfoHint } from './info-hint'

/**
 * Accessibility props handed to the control by the `Field` render-prop.
 * Spread them onto the input/select/textarea so the label, required flag and
 * error message are all announced.
 */
export interface FieldRenderProps {
  id: string
  'aria-required'?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export interface FieldProps {
  label: string
  /** Definition shown in a hover `InfoHint` next to the label. */
  hint?: React.ReactNode
  required?: boolean
  children: React.ReactNode | ((props: FieldRenderProps) => React.ReactNode)
  error?: string | null
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
 * focuses the input and assistive tech announces the field by name. ALWAYS use
 * the render-prop form — `{(f) => <Input {...f} />}` — and spread what it gives
 * you onto the control. Passing a plain node leaves `htmlFor` pointing at an id
 * that exists on no element, which is worse than no association at all: the
 * label looks wired up and announces nothing.
 */
export function Field({ label, hint, required, children, error }: FieldProps) {
  const controlId = React.useId()
  const errorId = `${controlId}-error`
  const renderProps: FieldRenderProps = {
    id: controlId,
    // A bare `*` draws a star and tells assistive tech nothing.
    ...(required ? { 'aria-required': true } : {}),
    ...(error ? { 'aria-invalid': true, 'aria-describedby': errorId } : {}),
  }
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={controlId} variant="small" className="text-ods-text-primary">
          {label}
          {required && ' *'}
        </Label>
        {hint && <InfoHint label={label}>{hint}</InfoHint>}
      </div>
      <div className="pt-[var(--spacing-system-xxs)]">
        {typeof children === 'function' ? children(renderProps) : children}
      </div>
      {/* `role="alert"` + the id the control points at: a validation message
          rendered as plain text is never announced. */}
      {error && (
        <p id={errorId} role="alert" className="text-h6 text-ods-error">
          {error}
        </p>
      )}
    </div>
  )
}
