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
  isResumeToken,
  parseFormDraftSaveRequest,
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

describe('parseFormDraftSaveRequest (the host-side read of a save)', () => {
  const base = { attempt_id: '6f1c2a7e-3b9d-4e21-9a4f-0c8d5e7b1a22', form_id: 'contact' };

  it('refuses an unknown form or a non-uuid attempt', () => {
    expect(parseFormDraftSaveRequest({ ...base, form_id: 'nope' })).toBeNull();
    expect(parseFormDraftSaveRequest({ ...base, attempt_id: 'x' })).toBeNull();
  });

  it('re-applies every rule and names what it dropped', () => {
    const parsed = parseFormDraftSaveRequest({
      ...base,
      values: { email: 'alex@northwind-it.com', password: 'hunter2', message: 'hi' },
      fields_filled: ['email', 'password', '<bad>'],
      last_field: 'email',
      completion_pct: 250,
      source_path: '//evil.example/x',
      utm: { source: ' linkedin ', bogus: 'x' },
      resume_token: 'k3Xq9vT2mB7wYp1sLr8dQa',
    });
    expect(parsed?.request).toEqual({
      attempt_id: base.attempt_id,
      form_id: 'contact',
      values: { email: 'alex@northwind-it.com' },
      fields_filled: ['email'],
      last_field: 'email',
      completion_pct: 100,
      source_path: '',
      utm: { source: 'linkedin' },
      resume_token: 'k3Xq9vT2mB7wYp1sLr8dQa',
    });
    expect(parsed?.dropped).toEqual(['password', 'message']);
  });

  it('checks resume tokens by one rule', () => {
    expect(isResumeToken('k3Xq9vT2mB7wYp1sLr8dQa')).toBe(true);
    expect(isResumeToken('short')).toBe(false);
    expect(isResumeToken('has spaces in it ok?')).toBe(false);
  });
});
