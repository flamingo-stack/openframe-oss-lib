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
 * AUTOFILL-PROOFING (load-bearing — real users were 403'd when autofill filled
 * the decoy; see humanity-signals.ts module doc): browsers ignore
 * `autocomplete="off"` for address-like fields, so the input is `readOnly`
 * until focused — autofill and password managers skip read-only inputs, while
 * a DOM-driving bot that focuses the field to type into it lifts the guard and
 * still trips the trap. The `data-*` attributes opt out of the major password
 * managers (1Password, LastPass, Bitwarden, Dashlane) by their documented
 * ignore contracts. React never re-applies the prop after the focus handler
 * flips the DOM property (same-value props aren't re-committed), so the
 * lift-on-focus sticks.
 *
 * forwardRef so `<HoneypotField {...honeypotInputProps} />` (which carries the
 * ref from useHumanitySignals) works on both React 18 and 19.
 */
export const HoneypotField = forwardRef<HTMLInputElement, { name: string }>(function HoneypotFieldImpl({ name }, ref) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -m-px h-px w-px overflow-hidden p-0 opacity-0">
      <input
        ref={ref}
        type="text"
        name={name}
        tabIndex={-1}
        autoComplete="off"
        readOnly
        onFocus={e => {
          const input = e.currentTarget;
          input.readOnly = false;
        }}
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
        data-form-type="other"
      />
    </div>
  );
});
HoneypotField.displayName = 'HoneypotField';
