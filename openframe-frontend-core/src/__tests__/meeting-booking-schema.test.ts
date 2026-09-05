import { describe, expect, it } from 'vitest';
import {
  isSupportedFormField,
  makeBookingSchema,
  makeDeferredBookingSchema,
  type MeetingFormField,
} from '../schemas/meeting-booking-schema';
import { BOOKING_BASE } from './fixtures/meeting-booking';

const base = BOOKING_BASE;

const endpoints = (required: boolean): MeetingFormField => ({
  name: 'number_of_endpoints',
  label: 'Number of endpoints',
  type: 'number',
  required,
});

describe('meeting booking schema — number questions', () => {
  it('treats a Number property as natively bookable, and unknown types as not', () => {
    expect(isSupportedFormField(endpoints(true))).toBe(true);
    expect(isSupportedFormField({ name: 'phone', label: 'Phone', type: 'phonenumber', required: false })).toBe(false);
  });

  it('accepts a decimal literal and keeps it a string on the wire', () => {
    const schema = makeBookingSchema([endpoints(true)], null);
    // `parse` throws on failure, so the value assertion is unconditional.
    expect(schema.parse({ ...base, formFields: { number_of_endpoints: '150' } }).formFields?.number_of_endpoints).toBe(
      '150',
    );
    expect(schema.safeParse({ ...base, formFields: { number_of_endpoints: '12.5' } }).success).toBe(true);
    expect(schema.safeParse({ ...base, formFields: { number_of_endpoints: '-3' } }).success).toBe(true);
  });

  it('rejects text, and an empty answer when required', () => {
    const schema = makeBookingSchema([endpoints(true)], null);
    expect(schema.safeParse({ ...base, formFields: { number_of_endpoints: 'lots' } }).success).toBe(false);
    expect(schema.safeParse({ ...base, formFields: { number_of_endpoints: '' } }).success).toBe(false);
    expect(schema.safeParse({ ...base, formFields: {} }).success).toBe(false);
  });

  it('allows an empty answer when optional', () => {
    const schema = makeBookingSchema([endpoints(false)], null);
    expect(schema.safeParse({ ...base, formFields: { number_of_endpoints: '' } }).success).toBe(true);
    expect(schema.safeParse({ ...base }).success).toBe(true);
    expect(schema.safeParse({ ...base, formFields: { number_of_endpoints: 'x' } }).success).toBe(false);
  });

  it('applies the same rule in the deferred (details-first) schema', () => {
    const schema = makeDeferredBookingSchema([endpoints(true)], null);
    const { startTimeMs: _s, durationMs: _d, timezone: _t, ...noSlot } = base;
    expect(schema.safeParse({ ...noSlot, formFields: { number_of_endpoints: '40' } }).success).toBe(true);
    expect(schema.safeParse({ ...noSlot, formFields: { number_of_endpoints: 'forty' } }).success).toBe(false);
  });
});
