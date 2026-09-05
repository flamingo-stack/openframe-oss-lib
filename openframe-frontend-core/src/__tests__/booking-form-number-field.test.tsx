import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BookingForm } from '../components/meeting-scheduler/booking-form';
import type { MeetingAvailability } from '../schemas/meeting-booking-schema';

const availability: MeetingAvailability = {
  meetingId: '1',
  monthOffset: 0,
  hasMore: false,
  durationsMs: [1_800_000],
  slotsByDurationMs: { '1800000': [1_700_000_000_000] },
  formFields: [{ name: 'number_of_endpoints', label: 'Number of endpoints', type: 'number', required: true }],
  legalConsent: null,
  hosts: [],
};

type Submit = (payload: Record<string, unknown>) => Promise<void>;

function mount(onSubmit = vi.fn<Submit>(() => Promise.resolve())) {
  render(
    <BookingForm
      availability={availability}
      meetingId="1"
      startTimeMs={1_700_000_000_000}
      durationMs={1_800_000}
      timezone="America/New_York"
      isSubmitting={false}
      onSubmit={onSubmit}
      honeypotInputProps={{ ref: createRef<HTMLInputElement>(), name: 'form_extra_note' }}
      getSignals={() => ({})}
    />,
  );
  return onSubmit;
}

const type = (el: HTMLElement, value: string) => fireEvent.input(el, { target: { value } });

describe('BookingForm — a HubSpot Number question', () => {
  it('renders as a numeric input under the property label', () => {
    mount();
    const input = screen.getByLabelText('Number of endpoints');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('inputmode', 'numeric');
  });

  it('refuses a non-numeric answer and never calls onSubmit', async () => {
    const onSubmit = mount();
    type(screen.getByLabelText('Email'), 'a@b.co');
    type(screen.getByLabelText('First Name'), 'A');
    type(screen.getByLabelText('Last Name'), 'B');
    // jsdom lets a number input hold arbitrary text; the resolver is the gate.
    type(screen.getByLabelText('Number of endpoints'), 'lots');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    expect(await screen.findByText('Number of endpoints must be a number')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a numeric answer as a string under the declared name', async () => {
    const onSubmit = mount();
    type(screen.getByLabelText('Email'), 'a@b.co');
    type(screen.getByLabelText('First Name'), 'A');
    type(screen.getByLabelText('Last Name'), 'B');
    type(screen.getByLabelText('Number of endpoints'), '150');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ formFields: { number_of_endpoints: '150' } }));
  });
});
