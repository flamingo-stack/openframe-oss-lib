'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '../../../ui/input';

interface ScheduleIntervalInputProps {
  /** The form's value. `null` = the box is empty. */
  value: number | null;
  onChange: (next: number | null) => void;
  /**
   * The form's own blur handler. Load-bearing, not optional plumbing: react-hook-form
   * learns a field was left ONLY through this, and `reValidateMode: 'onBlur'` is
   * what re-runs the schema. Without it an error the user has already fixed sits
   * on screen until the next Save.
   */
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  error?: string;
  min?: number;
  className?: string;
  'aria-label'?: string;
  /**
   * Marks this box as where `scrollToFirstInvalidField` should put focus when
   * the error is carried by an ancestor rather than by the input itself.
   */
  'data-invalid-focus'?: boolean;
}

/**
 * The `[interval]` half of the form's two duration pairs (Repeat in, Stop Retry
 * after).
 *
 * **What the user types owns the display; the form value never writes back into
 * it while the field has focus.** That inversion is the whole component. Binding
 * a number input straight to validated state reads as a bug rather than a rule:
 * the previous version coerced an emptied box back to a floor on every
 * keystroke, so the digit reappeared as fast as it was deleted and "1" could not
 * be typed over. Any round trip through `Number()` has the same shape in
 * smaller ways — a leading zero vanishes mid-word, "10" briefly becomes "1"
 * while a character is being removed.
 *
 * So the raw string is local state, and the form is told the PARSED value as it
 * changes. Keeping the form current (rather than committing on blur alone)
 * matters for one case: submitting with Enter never fires a blur, and a form
 * reading a stale interval would save a number the user cannot see.
 *
 * The reverse direction — form → box — is deliberately narrow. It runs only
 * when the field is NOT focused, which is exactly the set of changes that come
 * from somewhere else: the record arriving (`useSeedForm`), or the unit
 * dropdown raising the interval to its floor. While the box has focus those
 * cannot happen, and nothing else may repaint what is being typed.
 *
 * Validation timing is the form's business, not this component's: errors are
 * held until the first Save (`showErrors`) and re-checked on blur
 * (`reValidateMode`), so nothing here is judged mid-word.
 */
export function ScheduleIntervalInput(props: ScheduleIntervalInputProps) {
  const {
    value,
    onChange,
    onBlur,
    disabled,
    invalid,
    error,
    min,
    className,
    'aria-label': ariaLabel,
    'data-invalid-focus': invalidFocus,
  } = props;
  // Only a box that shows its own error wires `Input`'s error slot (Repeat in).
  // A wired slot wraps the box in a full-width column that reserves room for the
  // message, and in a row that column takes the width of the control beside it:
  // Stop Retry after, whose error the section carries, would squeeze its unit
  // select to nothing.
  const errorSlot = 'error' in props;
  const [text, setText] = useState(() => (value === null ? '' : String(value)));
  const focused = useRef(false);

  // Adopts the FORM's value, never its own output — hence the functional
  // `setText`, which keeps `text` out of the dependency list. Reacting to the
  // text this effect just wrote is what would fight the user.
  useEffect(() => {
    if (focused.current) return;
    const next = value === null ? '' : String(value);
    setText(current => (current === next ? current : next));
  }, [value]);

  return (
    <Input
      // Left as a number field so the stepper and the numeric keypad stay. The
      // one cost is that a browser reports `''` for a half-typed exponent
      // ("1e"), which reads here as a cleared box — it resolves itself on blur,
      // and it is the browser's own behaviour for the type rather than
      // something this component can improve on.
      type="number"
      min={min}
      inputMode="numeric"
      aria-label={ariaLabel}
      data-invalid-focus={invalidFocus || undefined}
      className={className}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        // Normalise what is shown to what was actually stored: "007" settles to
        // "7". Only on the way out, never mid-word.
        setText(value === null ? '' : String(value));
        onBlur?.();
      }}
      onChange={e => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === '') {
          onChange(null);
          return;
        }
        const parsed = Number(raw);
        onChange(Number.isFinite(parsed) ? parsed : null);
      }}
      disabled={disabled}
      invalid={invalid}
      {...(errorSlot ? { error } : {})}
    />
  );
}
