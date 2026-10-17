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

describe('BookingForm — a choice question drawn as chips', () => {
  it('puts every option on the form as a chip, and submits the chosen one under the question', async () => {
    const onSubmit = mountBookingForm(availability, { fieldCopy: { team_size: { display: 'chips' } } });
    expect(screen.queryByRole('combobox')).toBeNull();
    const chip = screen.getByRole('radio', { name: '2-5 people' });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-checked', 'true');
    fillIdentity();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ formFields: expect.objectContaining({ team_size: '2-5 people' }) }),
    );
  });

  it('keeps the dropdown without the display', () => {
    mountBookingForm(availability);
    expect(screen.queryByRole('radio', { name: 'Just me' })).toBeNull();
  });
});
