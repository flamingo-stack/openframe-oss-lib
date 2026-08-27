import { describe, expect, it } from 'vitest';

import {
  isSupportedFormField,
  makeBookingSchema,
  SUPPORTED_FORM_FIELD_TYPES,
  type MeetingFormField,
} from '../../schemas/meeting-booking-schema';
import { formatDurationCompact, formatUnderscoreText, titleCaseFromSlug } from '../format';
import {
  isListedSchedulingName,
  isValidSchedulingSlug,
  MAX_MONTH_OFFSET,
  parseSchedulingLinkName,
  schedulingAudienceKey,
} from '../hubspot-meetings-convention';
import { HUMANITY_SIGNAL_KEYS } from '../humanity-signals';

describe('slug shape validator', () => {
  it('allows N segments and rejects invalid characters', () => {
    expect(isValidSchedulingSlug('a/b/c-d')).toBe(true);
    expect(isValidSchedulingSlug('a b')).toBe(false);
    expect(isValidSchedulingSlug('a/../b')).toBe(false);
  });
});

describe('name-only convention', () => {
  it('audience segment = the LISTED opt-in marker', () => {
    expect(isListedSchedulingName('Sales Demo | Walkthrough | Prospect Investors')).toBe(true);
    expect(isListedSchedulingName('Sales Demo | Walkthrough')).toBe(false);
    expect(isListedSchedulingName('Just a title')).toBe(false);
    expect(isListedSchedulingName('Trailing pipes | | ')).toBe(false);
  });

  it('audience labels slugify to grouping keys (multi-word supported)', () => {
    expect(schedulingAudienceKey('Prospect Investors')).toBe('prospect-investors');
    expect(schedulingAudienceKey('OpenFrame Users')).toBe('openframe-users');
    expect(schedulingAudienceKey('  Link Builders!  ')).toBe('link-builders');
    expect(schedulingAudienceKey('***')).toBeNull();
  });

  it('splits "Title | Description | Audience Label" names on pipes', () => {
    expect(parseSchedulingLinkName('Sales Demo | 30-min OpenFrame walkthrough')).toEqual({
      title: 'Sales Demo',
      description: '30-min OpenFrame walkthrough',
      audienceLabel: null,
    });
    expect(parseSchedulingLinkName('Just a title')).toEqual({
      title: 'Just a title',
      description: null,
      audienceLabel: null,
    });
    expect(parseSchedulingLinkName('Trailing | ')).toEqual({
      title: 'Trailing',
      description: null,
      audienceLabel: null,
    });
    expect(
      parseSchedulingLinkName('Flamingo Investment Call | Invest in the future of IT | Prospect Investors'),
    ).toEqual({
      title: 'Flamingo Investment Call',
      description: 'Invest in the future of IT',
      audienceLabel: 'Prospect Investors',
    });
  });
});

describe('formatters (pinned — delegation must not change shipped output)', () => {
  it('formatUnderscoreText output is byte-identical after delegating to titleCaseFromSlug', () => {
    expect(formatUnderscoreText('self_hosted')).toBe('Self Hosted');
    // hyphenated input keeps its hyphen — the separator is underscore-only
    expect(formatUnderscoreText('self-hosted')).toBe('Self-hosted');
  });

  it('titleCaseFromSlug separator is explicit', () => {
    expect(titleCaseFromSlug('customer-success')).toBe('Customer Success');
    expect(titleCaseFromSlug('self_hosted', '_')).toBe('Self Hosted');
  });

  it('formatDurationCompact drops the zero-minutes tail on whole hours', () => {
    expect(formatDurationCompact(30 * 60)).toBe('30 min');
    expect(formatDurationCompact(3600)).toBe('1h');
    expect(formatDurationCompact(90 * 60)).toBe('1h 30m');
  });
});

describe('MAX_MONTH_OFFSET', () => {
  it('is the shared paging bound', () => {
    expect(MAX_MONTH_OFFSET).toBe(11);
  });
});

describe('makeBookingSchema × SUPPORTED_FORM_FIELD_TYPES', () => {
  const base = {
    meetingId: 'm1',
    startTimeMs: 1_785_769_200_000,
    durationMs: 1_800_000,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    timezone: 'UTC',
  };

  it('every supported type yields a working validator (renderer and factory move together)', () => {
    for (const type of SUPPORTED_FORM_FIELD_TYPES) {
      const field: MeetingFormField = {
        name: `q_${type}`,
        label: `Question (${type})`,
        type,
        required: true,
        options: type === 'select' || type === 'radio' ? ['a', 'b'] : undefined,
      };
      expect(isSupportedFormField(field)).toBe(true);
      const schema = makeBookingSchema([field], null);
      const answer = type === 'checkbox' ? true : type === 'select' || type === 'radio' ? 'a' : 'hello';
      const ok = schema.safeParse({ ...base, formFields: { [field.name]: answer } });
      expect(ok.success).toBe(true);
      const missing = schema.safeParse({ ...base, formFields: {} });
      expect(missing.success).toBe(false);
    }
  });

  it('unsupported types are excluded from validation (fail-closed happens at render)', () => {
    const field: MeetingFormField = { name: 'q_file', label: 'Upload', type: 'file', required: true };
    expect(isSupportedFormField(field)).toBe(false);
    const schema = makeBookingSchema([field], null);
    expect(schema.safeParse({ ...base }).success).toBe(true);
  });

  it('required consent checkboxes must be accepted', () => {
    const consent = {
      processingConsentText: 'We process your data.',
      processingConsentCheckboxLabel: null,
      communicationConsentText: null,
      communicationConsentCheckboxes: [{ communicationTypeId: '7', label: 'Marketing emails', required: true }],
      privacyPolicyText: null,
      isLegitimateInterest: false,
    };
    const schema = makeBookingSchema([], consent);
    expect(schema.safeParse({ ...base }).success).toBe(false);
    expect(
      schema.safeParse({ ...base, legalConsentResponses: [{ communicationTypeId: '7', consented: true }] }).success,
    ).toBe(true);
  });

  it('rejects invalid timezone and accepts valid IANA zones (reject, never coerce)', () => {
    const schema = makeBookingSchema([], null);
    expect(schema.safeParse({ ...base, timezone: 'not/a real zone' }).success).toBe(false);
    expect(schema.safeParse({ ...base, timezone: 'America/New_York' }).success).toBe(true);
  });

  it('strips unknown keys (humanity signals ride alongside, read raw pre-parse)', () => {
    const schema = makeBookingSchema([], null);
    const signals = Object.fromEntries(HUMANITY_SIGNAL_KEYS.map(key => [key, key === 'form_elapsed_ms' ? 4200 : '']));
    const parsed = schema.safeParse({ ...base, ...signals });
    // Throw rather than `if (parsed.success)`: the guard has to narrow the
    // discriminated union AND fail the test, and a conditional `expect` would
    // pass silently the day the parse starts failing.
    if (!parsed.success) throw new Error(`expected a successful parse: ${JSON.stringify(parsed.error.issues)}`);
    for (const key of HUMANITY_SIGNAL_KEYS) expect(key in parsed.data).toBe(false);
  });
});
