import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  BookingForm,
  type BookingFieldRow,
  type BookingFormConsent,
  evenSpan,
} from '../components/meeting-scheduler/booking-form';
import { availabilityWith } from './fixtures/meeting-booking';

// The consent row's checkbox measures itself; jsdom has no ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const availability = availabilityWith([
  { name: 'company', label: 'Company Name', type: 'text', required: true },
  { name: 'jobtitle', label: 'Job Title', type: 'text', required: false },
]);

const CONSENT_ERROR = 'Please agree to the Privacy Policy to continue.';
const consent: BookingFormConsent = { label: 'I agree to the Privacy Policy', errorMessage: CONSENT_ERROR };

type Submit = (payload: Record<string, unknown>) => Promise<void>;
const type = (el: HTMLElement, value: string) => fireEvent.input(el, { target: { value } });

function mount(props: {
  fieldRows?: BookingFieldRow[];
  consent?: BookingFormConsent;
  initialValues?: Record<string, unknown>;
}) {
  const onSubmit = vi.fn<Submit>(() => Promise.resolve());
  render(
    <BookingForm
      availability={availability}
      meetingId="1"
      startTimeMs={1_700_000_000_000}
      durationMs={1_800_000}
      timezone="UTC"
      isSubmitting={false}
      onSubmit={onSubmit}
      honeypotInputProps={{ ref: createRef<HTMLInputElement>(), name: 'form_extra_note' }}
      getSignals={() => ({})}
      {...props}
    />,
  );
  return onSubmit;
}

const fillIdentity = () => {
  type(screen.getByLabelText(/^Email/), 'a@b.co');
  type(screen.getByLabelText(/^First Name/), 'Ada');
  type(screen.getByLabelText(/^Last Name/), 'Lovelace');
};

describe('BookingForm — host fieldRows', () => {
  it('appends built-ins and declared questions no row names, so nothing required goes invisible', () => {
    mount({ fieldRows: [[{ name: 'firstName' }], [{ name: 'company' }]] });
    expect(screen.getByLabelText(/^Last Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Job Title/)).toBeInTheDocument();
  });

  it('renders a name placed twice once and drops a row that resolves to nothing', () => {
    mount({
      fieldRows: [
        [{ name: 'email' }, { name: 'email' }],
        [{ name: 'not_declared_yet' }],
        [{ name: 'firstName' }, { name: 'lastName' }],
      ],
    });
    expect(screen.getAllByLabelText(/^Email/)).toHaveLength(1);
    expect(screen.getByLabelText(/^First Name/)).toBeInTheDocument();
  });

  it('splits four columns evenly, the remainder going to the leading slots', () => {
    expect([0, 1, 2].map(i => evenSpan(3, i))).toEqual([2, 1, 1]);
    expect([0, 1].map(i => evenSpan(2, i))).toEqual([2, 2]);
    expect(evenSpan(1, 0)).toBe(4);
    expect([0, 4].map(i => evenSpan(5, i))).toEqual([1, 1]);
  });
});

describe('BookingForm — host consent row', () => {
  it('refuses to submit unticked, names why, and carries the tick as hostConsent once ticked', async () => {
    const onSubmit = mount({ consent });
    fillIdentity();
    type(screen.getByLabelText(/^Company Name/), 'Acme');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    expect(await screen.findByText(CONSENT_ERROR)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Booking' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ hostConsent: true, email: 'a@b.co' }));
  });

  it('restores the tick from initialValues (the details-first stash) on a remount', () => {
    mount({ consent, initialValues: { hostConsent: true } });
    expect(screen.getByRole('checkbox', { name: /I agree to the Privacy Policy/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
