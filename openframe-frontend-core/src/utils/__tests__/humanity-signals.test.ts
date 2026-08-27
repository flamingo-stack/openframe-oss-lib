import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MIN_FILL_MS,
  ELAPSED_MS_FIELD,
  evaluateHumanitySignals,
  extractHumanitySignals,
  findHoneypotCopySource,
  HONEYPOT_FIELD,
  LEGACY_HONEYPOT_FIELD,
} from '../humanity-signals';

const opts = { minFillMs: DEFAULT_MIN_FILL_MS };

describe('evaluateHumanitySignals', () => {
  it('allows a clean human submission', () => {
    expect(evaluateHumanitySignals({ email: 'a@b.co', [HONEYPOT_FIELD]: '', [ELAPSED_MS_FIELD]: 5000 }, opts)).toEqual({
      ok: true,
    });
  });

  it('blocks a filled honeypot with a value matching no other field', () => {
    expect(evaluateHumanitySignals({ email: 'a@b.co', [HONEYPOT_FIELD]: 'https://spam.example' }, opts)).toEqual({
      ok: false,
      reason: 'honeypot',
    });
  });

  it('blocks the legacy honeypot field name too (stale-lib embedder clients stay protected)', () => {
    expect(evaluateHumanitySignals({ email: 'a@b.co', [LEGACY_HONEYPOT_FIELD]: 'filled' }, opts)).toEqual({
      ok: false,
      reason: 'honeypot',
    });
  });

  it('forgives a honeypot value copied from another field (browser autofill signature)', () => {
    expect(
      evaluateHumanitySignals({ email: 'a@b.co', [HONEYPOT_FIELD]: 'a@b.co', [ELAPSED_MS_FIELD]: 5000 }, opts),
    ).toEqual({ ok: true, note: 'honeypot_autofill', sourceField: 'email' });
  });

  it('forgives autofill on the LEGACY field name (stale-lib client, current incident shape)', () => {
    expect(
      evaluateHumanitySignals({ email: 'a@b.co', [LEGACY_HONEYPOT_FIELD]: 'a@b.co', [ELAPSED_MS_FIELD]: 5000 }, opts),
    ).toEqual({ ok: true, note: 'honeypot_autofill', sourceField: 'email' });
  });

  it('forgives autofill copied from a nested field (booking formFields)', () => {
    expect(
      evaluateHumanitySignals(
        { email: 'a@b.co', formFields: { phone: '+1 555 010 0000' }, [HONEYPOT_FIELD]: '+1 555 010 0000' },
        opts,
      ),
    ).toEqual({ ok: true, note: 'honeypot_autofill', sourceField: 'formFields.phone' });
  });

  it('still applies the timing check when the honeypot is autofill-forgiven', () => {
    expect(
      evaluateHumanitySignals({ email: 'a@b.co', [HONEYPOT_FIELD]: 'a@b.co', [ELAPSED_MS_FIELD]: 50 }, opts),
    ).toEqual({ ok: false, reason: 'too_fast' });
  });

  it('a honeypot value matching only another SIGNAL key is not forgiven', () => {
    expect(evaluateHumanitySignals({ [HONEYPOT_FIELD]: 'xy', [LEGACY_HONEYPOT_FIELD]: 'xy' }, opts)).toEqual({
      ok: false,
      reason: 'honeypot',
    });
  });

  it('blocks sub-minimum fill time; missing timing never blocks', () => {
    expect(evaluateHumanitySignals({ [ELAPSED_MS_FIELD]: 100 }, opts)).toEqual({ ok: false, reason: 'too_fast' });
    expect(evaluateHumanitySignals({}, opts)).toEqual({ ok: true });
  });
});

describe('findHoneypotCopySource (autofill copy-match rules)', () => {
  it('matches with whitespace/case/unicode-width differences (normalized equality)', () => {
    expect(findHoneypotCopySource({ email: 'A@B.co ' }, 'a@b.co')).toBe('email');
    expect(findHoneypotCopySource({ name: 'Ｊｏ' }, 'jo')).toBe('name');
  });

  it('matches a differently-formatted phone via digits-only equality (waitlist E.164 case)', () => {
    expect(findHoneypotCopySource({ phone: '+15551234567' }, '(555) 123-4567')).toBe('phone');
  });

  it('matches string-array elements at top level and nested, reporting the path', () => {
    expect(findHoneypotCopySource({ tags: ['msp', 'security'] }, 'security')).toBe('tags[]');
    expect(findHoneypotCopySource({ formFields: { picks: ['alpha'] } }, 'alpha')).toBe('formFields.picks[]');
  });

  it('never matches a sub-minimum-length echo (1-char coincidence is not autofill)', () => {
    expect(findHoneypotCopySource({ initial: 'x' }, 'x')).toBeNull();
  });

  it('never matches empty fields or short digit runs', () => {
    expect(findHoneypotCopySource({ note: '  ' }, '  ')).toBeNull();
    expect(findHoneypotCopySource({ qty: '12' }, 'x12x')).toBeNull();
  });
});

describe('extractHumanitySignals', () => {
  it('coerces a non-string honeypot to a tripping non-empty string (objects/arrays included)', () => {
    expect(extractHumanitySignals({ [HONEYPOT_FIELD]: 123 }).honeypot).toBe('123');
    expect(extractHumanitySignals({ [HONEYPOT_FIELD]: [] }).honeypot).toBe('[]');
    expect(extractHumanitySignals({ [HONEYPOT_FIELD]: {} }).honeypot).toBe('{}');
  });

  it('prefers the current field name and reports provenance for monitoring', () => {
    expect(extractHumanitySignals({ [HONEYPOT_FIELD]: '', [LEGACY_HONEYPOT_FIELD]: 'old' })).toMatchObject({
      honeypot: '',
      honeypotField: 'current',
    });
    expect(extractHumanitySignals({ [LEGACY_HONEYPOT_FIELD]: 'old' })).toMatchObject({
      honeypot: 'old',
      honeypotField: 'legacy',
    });
    expect(extractHumanitySignals({}).honeypotField).toBeNull();
  });
});
