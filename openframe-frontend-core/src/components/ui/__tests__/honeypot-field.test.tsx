import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HONEYPOT_FIELD } from '../../../utils/humanity-signals';
import { HoneypotField } from '../honeypot-field';

/**
 * The readOnly-until-focus guard is bot-protection layer 2 (see
 * humanity-signals.ts module doc): autofill and password managers skip
 * read-only inputs, while a DOM-driving bot that focuses the field to type
 * lifts the guard and still trips the trap. The component's comment stakes the
 * lift on a React reconciliation detail — a same-value `readOnly` prop is
 * never re-committed, so the focus handler's DOM flip survives re-renders.
 * These tests pin both halves so a React upgrade or a "simplifying" refactor
 * can't silently regress the autofill-proofing.
 */

// `hidden: true` reaches through the aria-hidden wrapper — the decoy is
// deliberately outside the accessibility tree.
const getInput = (): HTMLInputElement => screen.getByRole('textbox', { hidden: true });

describe('HoneypotField readOnly-until-focus', () => {
  it('renders read-only (autofill skips it) with the password-manager ignore attributes', () => {
    render(<HoneypotField name={HONEYPOT_FIELD} />);
    const input = getInput();
    expect(input.readOnly).toBe(true);
    expect(input.name).toBe(HONEYPOT_FIELD);
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('data-1p-ignore')).toBe('true');
    expect(input.getAttribute('data-lpignore')).toBe('true');
    expect(input.getAttribute('data-bwignore')).toBe('true');
    expect(input.getAttribute('data-form-type')).toBe('other');
    expect(input.tabIndex).toBe(-1);
  });

  it('focus lifts the guard so a keystroke-driven bot can still fill the trap', () => {
    render(<HoneypotField name={HONEYPOT_FIELD} />);
    const input = getInput();
    fireEvent.focus(input);
    expect(input.readOnly).toBe(false);
  });

  it('the lifted guard survives a parent re-render (same-value props are not re-committed)', () => {
    const { rerender } = render(<HoneypotField name={HONEYPOT_FIELD} />);
    const input = getInput();
    fireEvent.focus(input);
    rerender(<HoneypotField name={HONEYPOT_FIELD} />);
    expect(getInput().readOnly).toBe(false);
  });
});
