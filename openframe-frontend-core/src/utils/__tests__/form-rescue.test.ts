import { describe, expect, it } from 'vitest';

import {
  filledRescueFields,
  isExcludedRescueField,
  isRescueEmail,
  rescueCompletionPct,
  sanitizeRescueFieldName,
  sanitizeRescueValues,
  FORM_RESCUE_MAX_VALUE_CHARS,
  RESCUE_FORMS,
  defineRescueForm,
  getRescueForm,
  listRescueForms,
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

describe('rescue form definitions', () => {
  it('knows the lib forms and refuses unknown ids', () => {
    expect(getRescueForm('contact')).toBe(RESCUE_FORMS.contact);
    expect(getRescueForm('meeting_booking')?.label).toBe('Meeting booking');
    expect(getRescueForm('anything_else')).toBeNull();
    expect(getRescueForm(42)).toBeNull();
  });

  it('lets a host add its own form beside it, with no central list', () => {
    const joinForm = defineRescueForm({ id: 'host_join', label: 'Join form' });
    expect(getRescueForm('host_join')).toBe(joinForm);
    expect(listRescueForms()).toContain(joinForm);
  });

  it('is idempotent for the same definition and refuses a conflicting one', () => {
    expect(defineRescueForm({ id: 'contact', label: 'Contact form' })).toBe(RESCUE_FORMS.contact);
    expect(() => defineRescueForm({ id: 'contact', label: 'Something else' })).toThrow(/already defined/);
    expect(() => defineRescueForm({ id: 'Bad Id!', label: 'x' })).toThrow(/invalid form id/);
  });
});
