import { describe, expect, it } from 'vitest'

import {
  isSchedulingNearMiss,
  isValidSchedulingSlug,
  MAX_MONTH_OFFSET,
  parseSchedulingLinkName,
  parseSchedulingSlug,
  schedulingPurposeLabel,
} from '../hubspot-meetings-convention'
import { formatDurationCompact, formatUnderscoreText, titleCaseFromSlug } from '../format'
import {
  isSupportedFormField,
  makeBookingSchema,
  SUPPORTED_FORM_FIELD_TYPES,
  type MeetingFormField,
} from '../../schemas/meeting-booking-schema'

describe('parseSchedulingSlug', () => {
  it('parses purpose-only sub-slugs', () => {
    expect(parseSchedulingSlug('vlad-m/call-marketing')).toEqual({ purpose: 'marketing', descriptor: null })
  })

  it('parses purpose + descriptor with the -- separator', () => {
    expect(parseSchedulingSlug('michael-assraf/call-sales--openframe-demo')).toEqual({
      purpose: 'sales',
      descriptor: 'openframe-demo',
    })
  })

  it('parses multi-word purposes', () => {
    expect(parseSchedulingSlug('call-customer-success--kickoff')).toEqual({
      purpose: 'customer-success',
      descriptor: 'kickoff',
    })
  })

  it('normalizes trim + case once at ingest', () => {
    expect(parseSchedulingSlug('  Vlad-M/CALL-MARKETING  ')).toEqual({ purpose: 'marketing', descriptor: null })
  })

  it('always reads the LAST segment regardless of segment count', () => {
    expect(parseSchedulingSlug('a/b/call-support--triage')).toEqual({ purpose: 'support', descriptor: 'triage' })
  })

  it('rejects personal defaults, legacy slugs, and bare/trailing markers', () => {
    expect(parseSchedulingSlug('michael-assraf')).toBeNull()
    expect(parseSchedulingSlug('michael-assraf/openframe-demo-and-deployment')).toBeNull()
    expect(parseSchedulingSlug('call')).toBeNull()
    expect(parseSchedulingSlug('call-')).toBeNull()
    expect(parseSchedulingSlug('someone/call-sales--')).toBeNull()
  })

  it('flags call-prefixed unparseable slugs as near-misses (and conforming ones as not)', () => {
    expect(isSchedulingNearMiss('someone/call-sales--')).toBe(true)
    expect(isSchedulingNearMiss('someone/call-')).toBe(true)
    expect(isSchedulingNearMiss('someone/call-sales--demo')).toBe(false)
    expect(isSchedulingNearMiss('michael-assraf')).toBe(false)
  })
})

describe('slug shape validator', () => {
  it('allows N segments and rejects invalid characters', () => {
    expect(isValidSchedulingSlug('a/b/c-d')).toBe(true)
    expect(isValidSchedulingSlug('a b')).toBe(false)
    expect(isValidSchedulingSlug('a/../b')).toBe(false)
  })
})

describe('labels + name split', () => {
  it('title-cases kebab purposes', () => {
    expect(schedulingPurposeLabel('customer-success')).toBe('Customer Success')
    expect(schedulingPurposeLabel('sales')).toBe('Sales')
  })

  it('splits "Title | Description" names on the first pipe', () => {
    expect(parseSchedulingLinkName('Sales Demo | 30-min OpenFrame walkthrough')).toEqual({
      title: 'Sales Demo',
      description: '30-min OpenFrame walkthrough',
    })
    expect(parseSchedulingLinkName('Just a title')).toEqual({ title: 'Just a title', description: null })
    expect(parseSchedulingLinkName('Trailing | ')).toEqual({ title: 'Trailing', description: null })
  })
})

describe('formatters (pinned — delegation must not change shipped output)', () => {
  it('formatUnderscoreText output is byte-identical after delegating to titleCaseFromSlug', () => {
    expect(formatUnderscoreText('self_hosted')).toBe('Self Hosted')
    // hyphenated input keeps its hyphen — the separator is underscore-only
    expect(formatUnderscoreText('self-hosted')).toBe('Self-hosted')
  })

  it('titleCaseFromSlug separator is explicit', () => {
    expect(titleCaseFromSlug('customer-success')).toBe('Customer Success')
    expect(titleCaseFromSlug('self_hosted', '_')).toBe('Self Hosted')
  })

  it('formatDurationCompact drops the zero-minutes tail on whole hours', () => {
    expect(formatDurationCompact(30 * 60)).toBe('30 min')
    expect(formatDurationCompact(3600)).toBe('1h')
    expect(formatDurationCompact(90 * 60)).toBe('1h 30m')
  })
})

describe('MAX_MONTH_OFFSET', () => {
  it('is the shared paging bound', () => {
    expect(MAX_MONTH_OFFSET).toBe(11)
  })
})

describe('makeBookingSchema × SUPPORTED_FORM_FIELD_TYPES', () => {
  const base = {
    meetingId: 'm1',
    startTimeMs: 1_785_769_200_000,
    durationMs: 1_800_000,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    timezone: 'UTC',
  }

  it('every supported type yields a working validator (renderer and factory move together)', () => {
    for (const type of SUPPORTED_FORM_FIELD_TYPES) {
      const field: MeetingFormField = {
        name: `q_${type}`,
        label: `Question (${type})`,
        type,
        required: true,
        options: type === 'select' || type === 'radio' ? ['a', 'b'] : undefined,
      }
      expect(isSupportedFormField(field)).toBe(true)
      const schema = makeBookingSchema([field], null)
      const answer = type === 'checkbox' ? true : type === 'select' || type === 'radio' ? 'a' : 'hello'
      const ok = schema.safeParse({ ...base, formFields: { [field.name]: answer } })
      expect(ok.success).toBe(true)
      const missing = schema.safeParse({ ...base, formFields: {} })
      expect(missing.success).toBe(false)
    }
  })

  it('unsupported types are excluded from validation (fail-closed happens at render)', () => {
    const field: MeetingFormField = { name: 'q_file', label: 'Upload', type: 'file', required: true }
    expect(isSupportedFormField(field)).toBe(false)
    const schema = makeBookingSchema([field], null)
    expect(schema.safeParse({ ...base }).success).toBe(true)
  })

  it('required consent checkboxes must be accepted', () => {
    const consent = {
      processingConsentText: 'We process your data.',
      processingConsentCheckboxLabel: null,
      communicationConsentText: null,
      communicationConsentCheckboxes: [{ communicationTypeId: '7', label: 'Marketing emails', required: true }],
      privacyPolicyText: null,
      isLegitimateInterest: false,
    }
    const schema = makeBookingSchema([], consent)
    expect(schema.safeParse({ ...base }).success).toBe(false)
    expect(
      schema.safeParse({ ...base, legalConsentResponses: [{ communicationTypeId: '7', consented: true }] }).success,
    ).toBe(true)
  })

  it('rejects invalid timezone and accepts valid IANA zones (reject, never coerce)', () => {
    const schema = makeBookingSchema([], null)
    expect(schema.safeParse({ ...base, timezone: 'not/a real zone' }).success).toBe(false)
    expect(schema.safeParse({ ...base, timezone: 'America/New_York' }).success).toBe(true)
  })

  it('strips unknown keys (humanity signals ride alongside, read raw pre-parse)', () => {
    const schema = makeBookingSchema([], null)
    const parsed = schema.safeParse({ ...base, contact_url_confirm: '', form_elapsed_ms: 4200 })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect('contact_url_confirm' in parsed.data).toBe(false)
    }
  })
})
