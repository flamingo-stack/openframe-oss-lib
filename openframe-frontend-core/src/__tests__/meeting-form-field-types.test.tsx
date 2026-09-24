import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  blocksNativeBooking,
  isRecognisedFormFieldType,
  makeBookingSchema,
  normalizeFormField,
  resolveFormFieldControl,
  type MeetingFormField,
} from '../schemas/meeting-booking-schema';
import { BOOKING_BASE, availabilityWith, fillIdentity, mountBookingForm, typeInto } from './fixtures/meeting-booking';

const q = (type: string, extra: Partial<MeetingFormField> = {}): MeetingFormField => ({
  name: `q_${type}`,
  label: `Q ${type}`,
  type,
  required: false,
  ...extra,
});

describe('resolveFormFieldControl — every HubSpot type lands on a control', () => {
  // Every (type, fieldType) pair a HubSpot portal's contact properties carry
  // (measured on the Flamingo portal, 2026-09-24), plus the ones no property
  // uses yet. The resolver is TOTAL: none of these may make a link unbookable.
  it.each([
    ['text', 'string', undefined, 'text'],
    ['textarea', 'string', undefined, 'textarea'],
    ['number', 'number', undefined, 'number'],
    ['phonenumber', 'string', undefined, 'phone'],
    ['phonenumber', 'phone_number', undefined, 'phone'],
    ['booleancheckbox', 'bool', undefined, 'checkbox'],
    ['booleancheckbox', 'enumeration', ['true', 'false'], 'checkbox'],
    ['checkbox', 'enumeration', ['a', 'b'], 'multiselect'],
    ['checkbox', undefined, undefined, 'checkbox'],
    ['select', 'enumeration', ['a'], 'select'],
    ['select', 'enumeration', undefined, 'text'],
    ['radio', 'enumeration', ['a'], 'radio'],
    ['date', 'date', undefined, 'date'],
    ['date', 'datetime', undefined, 'date'],
    ['html', 'string', undefined, 'display'],
    ['calculation_equation', 'number', undefined, 'display'],
    ['calculation_rollup', 'datetime', undefined, 'display'],
    ['file', 'string', undefined, 'unanswerable'],
    // Types HubSpot has not shipped (yet): the data type decides, else text.
    ['hologram', 'phone_number', undefined, 'phone'],
    ['hologram', 'bool', undefined, 'checkbox'],
    ['hologram', 'enumeration', ['a'], 'select'],
    ['hologram', undefined, ['a'], 'select'],
    ['hologram', undefined, undefined, 'text'],
    ['PhoneNumber', undefined, undefined, 'phone'],
  ] as const)('%s / %s (options: %s) → %s', (type, dataType, options, expected) => {
    expect(resolveFormFieldControl(q(type, { dataType, options: options ? [...options] : undefined }))).toBe(expected);
  });

  it('is idempotent: a normalized field resolves to the same control again', () => {
    const fields = [
      q('phonenumber'),
      q('checkbox', { options: ['a', 'b'] }),
      q('booleancheckbox'),
      q('booleancheckbox', { dataType: 'enumeration', options: ['true', 'false'] }),
      q('date'),
      q('select', { options: ['a'] }),
      q('hologram'),
    ];
    for (const f of fields) {
      const once = normalizeFormField(f);
      expect(once && normalizeFormField(once)).toEqual(once);
    }
  });

  it('tells a host which types were guessed rather than mapped', () => {
    for (const t of [
      'phonenumber',
      'booleancheckbox',
      'checkbox',
      'calculation_equation',
      'file',
      'html',
      'multiselect',
    ]) {
      expect(isRecognisedFormFieldType(t)).toBe(true);
    }
    expect(isRecognisedFormFieldType('hologram')).toBe(false);
  });

  it('only a REQUIRED unanswerable question blocks native booking', () => {
    expect(blocksNativeBooking(q('file', { required: true }))).toBe(true);
    expect(blocksNativeBooking(q('file'))).toBe(false);
    expect(blocksNativeBooking(q('phonenumber', { required: true }))).toBe(false);
    expect(blocksNativeBooking(q('hologram', { required: true }))).toBe(false);
  });
});

describe('validators for the new controls', () => {
  const parse = (field: MeetingFormField, value: unknown) =>
    makeBookingSchema([field], null).safeParse({ ...BOOKING_BASE, formFields: { [field.name]: value } }).success;

  it('phone accepts what people type and rejects what is not a number', () => {
    const phone = q('phonenumber', { required: true });
    for (const ok of ['+1 (415) 555-2671', '020 7946 0958', '+972-54-123-4567', '415.555.2671 ext. 12']) {
      expect(parse(phone, ok)).toBe(true);
    }
    for (const bad of ['', 'call me', '123', '+1 415 555 2671 999 999 999 999']) {
      expect(parse(phone, bad)).toBe(false);
    }
  });

  it('date accepts a real ISO day only', () => {
    const date = q('date', { required: true });
    expect(parse(date, '2026-02-28')).toBe(true);
    expect(parse(date, '2026-02-30')).toBe(false);
    expect(parse(date, '28/02/2026')).toBe(false);
  });

  it('multiselect is a ;-joined subset of the declared options', () => {
    const multi = q('checkbox', { required: true, options: ['rmm', 'psa', 'backup'] });
    expect(parse(multi, 'rmm;backup')).toBe(true);
    expect(parse(multi, 'rmm;crm')).toBe(false);
    expect(parse(multi, '')).toBe(false);
  });

  it('an unknown type validates as text rather than being dropped', () => {
    const unknown = q('hologram', { required: true });
    expect(parse(unknown, 'anything')).toBe(true);
    expect(parse(unknown, '')).toBe(false);
  });

  it('display blocks carry no answer and never make the form required', () => {
    const html = q('html', { required: true });
    expect(makeBookingSchema([html], null).safeParse({ ...BOOKING_BASE }).success).toBe(true);
  });
});

describe('BookingForm — a link with a phone question (the reported outage)', () => {
  it('renders every question and submits HubSpot-shaped values', async () => {
    const onSubmit = mountBookingForm(
      availabilityWith([
        q('phonenumber', { name: 'phone', label: 'Phone number', dataType: 'string', required: true }),
        q('checkbox', {
          name: 'tools',
          label: 'Tools',
          dataType: 'enumeration',
          options: ['rmm', 'psa'],
          optionLabels: { rmm: 'RMM', psa: 'PSA' },
        }),
        q('hologram', { name: 'mystery', label: 'Mystery' }),
        q('html', { name: 'blurb', label: 'Some rich text' }),
      ]),
    );

    typeInto(screen.getByLabelText(/^Phone number/), ' +1 415 555 2671 ');
    fireEvent.click(screen.getByLabelText('PSA'));
    fireEvent.click(screen.getByLabelText('RMM'));
    typeInto(screen.getByLabelText(/^Mystery/), 'still answerable');
    expect(screen.queryByText('Some rich text')).not.toBeInTheDocument();
    fillIdentity();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // Options are joined in DECLARED order, whatever order they were ticked in.
    expect(onSubmit.mock.calls[0][0].formFields).toEqual({
      phone: '+1 415 555 2671',
      tools: 'rmm;psa',
      mystery: 'still answerable',
    });
  });

  it('blocks submit on a malformed phone number', async () => {
    const onSubmit = mountBookingForm(
      availabilityWith([q('phonenumber', { name: 'phone', label: 'Phone', required: true })]),
    );
    typeInto(screen.getByLabelText(/^Phone/), 'call me maybe');
    fillIdentity();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    expect(await screen.findByText('Please enter a valid phone number for Phone')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
