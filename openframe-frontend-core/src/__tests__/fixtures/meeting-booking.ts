import { fireEvent, screen } from '@testing-library/react';
import { createRef } from 'react';
import type { MeetingAvailability, MeetingFormField } from '../../schemas/meeting-booking-schema';

/** One well-formed slot-first payload minus the questions — the base every
 *  booking-schema test extends, declared once. */
export const BOOKING_BASE = {
  meetingId: '1',
  startTimeMs: 1_700_000_000_000,
  durationMs: 1_800_000,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  timezone: 'UTC',
};

/** A minimal availability payload carrying exactly the given questions. */
export function availabilityWith(formFields: MeetingFormField[]): MeetingAvailability {
  return {
    meetingId: '1',
    monthOffset: 0,
    hasMore: false,
    durationsMs: [1_800_000],
    slotsByDurationMs: { '1800000': [1_700_000_000_000] },
    formFields,
    legalConsent: null,
    hosts: [],
  };
}

/** Everything a `BookingForm` mount needs besides the availability and the
 *  submit handler. A function: the honeypot ref must be fresh per mount. */
export const bookingFormBaseProps = () => ({
  meetingId: '1',
  startTimeMs: 1_700_000_000_000,
  durationMs: 1_800_000,
  timezone: 'UTC',
  isSubmitting: false,
  honeypotInputProps: { ref: createRef<HTMLInputElement>(), name: 'form_extra_note' },
  getSignals: () => ({}),
});

export const typeInto = (el: HTMLElement, value: string) => fireEvent.input(el, { target: { value } });

/** The identity trio every submit needs. */
export const fillIdentity = () => {
  typeInto(screen.getByLabelText(/^Email/), 'a@b.co');
  typeInto(screen.getByLabelText(/^First Name/), 'Ada');
  typeInto(screen.getByLabelText(/^Last Name/), 'Lovelace');
};
