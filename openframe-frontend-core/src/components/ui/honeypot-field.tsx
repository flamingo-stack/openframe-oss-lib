'use client';

import { forwardRef } from 'react';

/**
 * HoneypotField — an invisible decoy input for bot detection. Real users never
 * see or fill it; naive bots that fill every field trip it (the server blocks
 * any submission where this field is non-empty).
 *
 * Made invisible WITHOUT `type="hidden"` / `display:none` (sophisticated bots
 * skip those): an off-screen, zero-size, aria-hidden, non-focusable,
 * non-pointer wrapper. Layout utilities only — no colours/hex (ODS-clean). No
 * <label> (avoids id coupling); `aria-hidden` + `tabIndex={-1}` keep it out of
 * the accessibility tree and tab order.
 *
 * forwardRef so `<HoneypotField {...honeypotInputProps} />` (which carries the
 * ref from useHumanitySignals) works on both React 18 and 19.
 */
export const HoneypotField = forwardRef<HTMLInputElement, { name: string }>(function HoneypotFieldImpl({ name }, ref) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -m-px h-px w-px overflow-hidden p-0 opacity-0">
      <input ref={ref} type="text" name={name} tabIndex={-1} autoComplete="off" />
    </div>
  );
});
HoneypotField.displayName = 'HoneypotField';
