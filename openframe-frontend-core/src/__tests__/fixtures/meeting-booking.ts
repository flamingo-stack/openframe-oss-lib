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
