import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MIN_FILL_MS,
  ELAPSED_MS_FIELD,
  evaluateHumanitySignals,
  extractHumanitySignals,
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
    ).toEqual({ ok: true, note: 'honeypot_autofill' });
  });

  it('forgives autofill copied from a nested field (booking formFields)', () => {
    expect(
      evaluateHumanitySignals(
        { email: 'a@b.co', formFields: { phone: '+1 555 0100' }, [HONEYPOT_FIELD]: '+1 555 0100' },
        opts,
      ),
    ).toEqual({ ok: true, note: 'honeypot_autofill' });
  });

  it('still applies the timing check when the honeypot is autofill-forgiven', () => {
    expect(
      evaluateHumanitySignals({ email: 'a@b.co', [HONEYPOT_FIELD]: 'a@b.co', [ELAPSED_MS_FIELD]: 50 }, opts),
    ).toEqual({ ok: false, reason: 'too_fast' });
  });

  it('a honeypot value matching only another SIGNAL key is not forgiven', () => {
    expect(evaluateHumanitySignals({ [HONEYPOT_FIELD]: 'x', [LEGACY_HONEYPOT_FIELD]: 'x' }, opts)).toEqual({
      ok: false,
      reason: 'honeypot',
    });
  });

  it('blocks sub-minimum fill time; missing timing never blocks', () => {
    expect(evaluateHumanitySignals({ [ELAPSED_MS_FIELD]: 100 }, opts)).toEqual({ ok: false, reason: 'too_fast' });
    expect(evaluateHumanitySignals({}, opts)).toEqual({ ok: true });
  });
});

describe('extractHumanitySignals', () => {
  it('coerces a non-string honeypot to a tripping string; prefers the current field name', () => {
    expect(extractHumanitySignals({ [HONEYPOT_FIELD]: 123 }).honeypot).toBe('123');
    expect(extractHumanitySignals({ [HONEYPOT_FIELD]: '', [LEGACY_HONEYPOT_FIELD]: 'old' }).honeypot).toBe('');
    expect(extractHumanitySignals({ [LEGACY_HONEYPOT_FIELD]: 'old' }).honeypot).toBe('old');
  });
});
