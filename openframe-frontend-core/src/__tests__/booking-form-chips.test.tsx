import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { availabilityWith, fillIdentity, mountBookingForm } from './fixtures/meeting-booking';

const availability = availabilityWith([
  {
    name: 'team_size',
    label: 'How big is your IT team?',
    type: 'select',
    required: true,
    options: ['Just me', '2-5 people', '6 or more'],
  },
]);

const chips = { fieldCopy: { team_size: { display: 'chips' as const } } };

describe('BookingForm — a choice question drawn as chips', () => {
  it("keeps the dropdown by default: chips are the host's choice", () => {
    mountBookingForm(availability);
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('draws the question as chips when the host asks, named by its label, and submits the chosen one', async () => {
    const onSubmit = mountBookingForm(availability, chips);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('radiogroup', { name: /How big is your IT team\?/ })).toBeInTheDocument();
    const chip = screen.getByRole('radio', { name: '2-5 people' });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-checked', 'true');
    fillIdentity();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [submitted] = onSubmit.mock.calls[0] as [{ formFields: Record<string, string> }];
    expect(submitted.formFields.team_size).toBe('2-5 people');
  });

  it('keeps the dropdown for a long list of answers, even when the host asks for chips', () => {
    const long = availabilityWith([
      {
        name: 'country',
        label: 'Country',
        type: 'select',
        required: false,
        options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      },
    ]);
    mountBookingForm(long, { fieldCopy: { country: { display: 'chips' } } });
    expect(screen.queryByRole('radio', { name: 'A' })).toBeNull();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('draws a radio question as chips when the host asks', () => {
    const radio = availabilityWith([
      { name: 'urgency', label: 'How soon?', type: 'radio', required: false, options: ['This week', 'This month'] },
    ]);
    mountBookingForm(radio, { fieldCopy: { urgency: { display: 'chips' } } });
    expect(screen.getByRole('radiogroup', { name: /How soon\?/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'This week' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'This month' })).toBeInTheDocument();
  });
});
