import { describe, expect, it } from 'vitest';

import {
  filledRescueFields,
  isExcludedRescueField,
  isFormRescueFormId,
  isRescueEmail,
  rescueCompletionPct,
  sanitizeRescueFieldName,
  sanitizeRescueValues,
  FORM_RESCUE_MAX_VALUE_CHARS,
} from '../form-rescue';

/**
 * These rules run on BOTH sides: the browser before a draft is sent and the
 * host before it is stored. The cases are the ones the privacy contract rests
 * on: nothing outside the allowlist is ever a value, and a credential field is
 * never even reported by name.
 */
describe('sanitizeRescueValues', () => {
  it('keeps only allowlisted contact fields, trimmed', () => {
    expect(
      sanitizeRescueValues({
        email: '  alex@northwind-it.com ',
        name: 'Alex',
        company: 'Northwind IT',
        message: 'free text never kept',
        phone: '+15550100',
        password: 'hunter2',
        card_number: '4242424242424242',
      }),
    ).toEqual({ email: 'alex@northwind-it.com', name: 'Alex', company: 'Northwind IT' });
  });

  it('caps every value', () => {
    const out = sanitizeRescueValues({ company: 'x'.repeat(500) });
    expect(out.company).toHaveLength(FORM_RESCUE_MAX_VALUE_CHARS);
  });

  it('drops non-strings and empties', () => {
    expect(sanitizeRescueValues({ email: 42, name: '   ', company: { a: 1 } })).toEqual({});
    expect(sanitizeRescueValues(null)).toEqual({});
  });
});

describe('filledRescueFields', () => {
  it('reports visible filled fields by name, never credentials', () => {
    expect(
      filledRescueFields({ email: 'a@b.co', message: 'hi', password: 'x', companySize: '' }, [
        'email',
        'message',
        'password',
        'companySize',
      ]),
    ).toEqual(['email', 'message']);
  });

  it('counts a nested answer group as filled when any answer is', () => {
    expect(filledRescueFields({ formFields: { a: '', b: 'yes' } }, ['formFields'])).toEqual(['formFields']);
  });
});

describe('field and id checks', () => {
  it('excludes credential and payment names', () => {
    for (const name of [
      'password',
      'passcode',
      'cardNumber',
      'cvv',
      'ssn',
      'iban',
      'apiToken',
      'client_secret',
      'otp',
    ]) {
      expect(isExcludedRescueField(name)).toBe(true);
    }
    for (const name of ['email', 'company', 'companySize', 'jobtitle']) {
      expect(isExcludedRescueField(name)).toBe(false);
    }
  });

  it('accepts only known form ids', () => {
    expect(isFormRescueFormId('contact')).toBe(true);
    expect(isFormRescueFormId('meeting_booking')).toBe(true);
    expect(isFormRescueFormId('anything_else')).toBe(false);
  });

  it('validates emails the way the contact table does', () => {
    expect(isRescueEmail('alex@northwind-it.com')).toBe(true);
    expect(isRescueEmail('alex@')).toBe(false);
    expect(isRescueEmail(undefined)).toBe(false);
  });

  it('bounds field names', () => {
    expect(sanitizeRescueFieldName('company_size')).toBe('company_size');
    expect(sanitizeRescueFieldName('<script>')).toBeNull();
    expect(sanitizeRescueFieldName('password')).toBeNull();
  });

  it('computes completion as a bounded percentage', () => {
    expect(rescueCompletionPct(3, 4)).toBe(75);
    expect(rescueCompletionPct(0, 0)).toBe(0);
    expect(rescueCompletionPct(9, 4)).toBe(100);
  });
});
