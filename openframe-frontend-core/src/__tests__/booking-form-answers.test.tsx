/**
 * `answers`: what a host took outside the form (a landing hero's one-tap
 * question) reaches the question without a remount, and never over what the
 * visitor typed into the form.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BookingForm } from '../components/meeting-scheduler/booking-form';
import { availabilityWith, bookingFormBaseProps, typeInto } from './fixtures/meeting-booking';

const availability = availabilityWith([
  {
    name: 'team_size',
    label: 'How big is your IT team?',
    type: 'select',
    required: false,
    options: ['Just me', '2-5 people'],
  },
  { name: 'message', label: 'Anything else?', type: 'text', required: false },
]);

function renderForm(answers?: Record<string, string>) {
  const onSubmit = vi.fn(() => Promise.resolve());
  const view = render(<BookingForm {...bookingFormBaseProps()} availability={availability} onSubmit={onSubmit} answers={answers} />);
  return {
    rerender: (next: Record<string, string>) =>
      view.rerender(<BookingForm {...bookingFormBaseProps()} availability={availability} onSubmit={onSubmit} answers={next} />),
  };
}

describe('BookingForm answers', () => {
  it('writes a new answer into its question without a remount, keeping what was typed elsewhere', async () => {
    const { rerender } = renderForm();
    typeInto(screen.getByLabelText(/^Email/), 'a@b.co');
    rerender({ message: 'Patching is late' });
    await waitFor(() => expect(screen.getByLabelText(/^Anything else\?/)).toHaveValue('Patching is late'));
    expect(screen.getByLabelText(/^Email/)).toHaveValue('a@b.co');
  });

  it('never overwrites a question the visitor edited in the form', async () => {
    const { rerender } = renderForm();
    const message = screen.getByLabelText(/^Anything else\?/);
    typeInto(message, 'Mine');
    fireEvent.blur(message);
    rerender({ message: 'From the page' });
    await waitFor(() => expect(message).toHaveValue('Mine'));
  });

  it('ignores an answer to a question the form does not ask', async () => {
    const { rerender } = renderForm();
    rerender({ not_declared: 'x', message: 'Asked' });
    await waitFor(() => expect(screen.getByLabelText(/^Anything else\?/)).toHaveValue('Asked'));
    expect(screen.queryByDisplayValue('x')).not.toBeInTheDocument();
  });
});
