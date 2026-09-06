import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BookingForm } from '../components/meeting-scheduler/booking-form';
import { availabilityWith, bookingFormBaseProps, fillIdentity, typeInto } from './fixtures/meeting-booking';

const availability = availabilityWith([
  { name: 'number_of_endpoints', label: 'Number of endpoints', type: 'number', required: true },
]);

type Submit = (payload: Record<string, unknown>) => Promise<void>;

function mount(onSubmit = vi.fn<Submit>(() => Promise.resolve())) {
  render(
    <BookingForm
      {...bookingFormBaseProps()}
      timezone="America/New_York"
      availability={availability}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

describe('BookingForm — a HubSpot Number question', () => {
  it('renders as a numeric input under the property label', () => {
    mount();
    const input = screen.getByLabelText(/^Number of endpoints/);
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('reports a required question left empty as required, and never calls onSubmit', async () => {
    const onSubmit = mount();
    fillIdentity();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    // The required rule is FIRST on the chain, so the message is "is required",
    // not the type's own "must be a number".
    expect(await screen.findByText('Number of endpoints is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('canonicalises what the browser accepts before it reaches the wire', async () => {
    const onSubmit = mount();
    fillIdentity();
    // `1e3` is a valid number-input value; the wire wants the decimal literal.
    typeInto(screen.getByLabelText(/^Number of endpoints/), '1e3');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ formFields: { number_of_endpoints: '1000' } }));
  });

  it('submits a numeric answer as a string under the declared name', async () => {
    const onSubmit = mount();
    fillIdentity();
    typeInto(screen.getByLabelText(/^Number of endpoints/), '150');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ formFields: { number_of_endpoints: '150' } }));
  });

  it('passes an answer already in wire shape through verbatim (no float round-trip)', async () => {
    const onSubmit = mount();
    fillIdentity();
    // 20 digits: `String(Number(...))` would reshape this to `1.2345678901234568e+19`.
    typeInto(screen.getByLabelText(/^Number of endpoints/), '12345678901234567890');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ formFields: { number_of_endpoints: '12345678901234567890' } }),
    );
  });

  it('leaves a value it cannot bring into wire shape to the validator', async () => {
    const onSubmit = mount();
    fillIdentity();
    // `String(1e21)` is `1e+21` — not a decimal literal — so the input stays as typed and fails as a number.
    typeInto(screen.getByLabelText(/^Number of endpoints/), '1e21');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    expect(await screen.findByText('Number of endpoints must be a number')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
