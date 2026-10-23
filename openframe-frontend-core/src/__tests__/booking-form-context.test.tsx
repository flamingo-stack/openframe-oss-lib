/**
 * `context`: what a page learned before the form, outside the link's questions (the cards a visitor picked). The
 * form shows it as tags and sends it with the booking whatever the link declares; in `deferSlot` mode the parent
 * attaches it at the POST, so the form only shows it. The server reads it back with `readBookingContext`.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BOOKING_CONTEXT_FIELD,
  BOOKING_CONTEXT_LIMITS,
  bookingContextFields,
  readBookingContext,
} from '../schemas/meeting-booking-schema';
import { availabilityWith, fillIdentity, mountBookingForm } from './fixtures/meeting-booking';

const availability = availabilityWith([]);
const context = { label: 'Fix these first:', items: ["We can't hire.", 'A laptop is dying.'] };

describe('BookingForm context', () => {
  it('draws the context as a labelled list of tags', () => {
    mountBookingForm(availability, { context });
    const list = screen.getByRole('list', { name: 'Fix these first:' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map(item => item.textContent),
    ).toEqual(context.items);
  });

  it('draws nothing without a line', () => {
    mountBookingForm(availability, { context: { label: 'Fix these first:', items: [] } });
    expect(screen.queryByText('Fix these first:')).not.toBeInTheDocument();
  });

  it('sends the context with the booking, beside the answers', async () => {
    const onSubmit = mountBookingForm(availability, { context });
    fillIdentity();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ [BOOKING_CONTEXT_FIELD]: context }));
  });

  it('leaves the context to the parent when the slot is deferred', async () => {
    const onSubmit = mountBookingForm(availability, { context, deferSlot: true, submitLabel: 'Continue' });
    fillIdentity();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty(BOOKING_CONTEXT_FIELD);
  });
});

describe('booking context on the wire', () => {
  it('reads back what the form sent', () => {
    expect(readBookingContext(bookingContextFields(context))).toEqual(context);
  });

  it('sends nothing for an empty context', () => {
    expect(bookingContextFields({ label: 'x', items: [] })).toEqual({});
    expect(bookingContextFields(null)).toEqual({});
  });

  it('refuses a malformed or oversized context whole', () => {
    expect(readBookingContext({})).toBeNull();
    expect(readBookingContext({ [BOOKING_CONTEXT_FIELD]: { label: 'x', items: 'not a list' } })).toBeNull();
    const tooMany = Array.from({ length: BOOKING_CONTEXT_LIMITS.items + 1 }, (_, i) => `line ${i}`);
    expect(readBookingContext({ [BOOKING_CONTEXT_FIELD]: { label: 'x', items: tooMany } })).toBeNull();
    const tooLong = 'a'.repeat(BOOKING_CONTEXT_LIMITS.item + 1);
    expect(readBookingContext({ [BOOKING_CONTEXT_FIELD]: { label: 'x', items: [tooLong] } })).toBeNull();
  });
});
