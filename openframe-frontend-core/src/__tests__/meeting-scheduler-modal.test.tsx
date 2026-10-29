import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HubSpotMeetingScheduler,
  MeetingSchedulerModal,
  type HubSpotMeetingSchedulerProps,
  type MeetingSchedulerModalProps,
} from '../components/meeting-scheduler';
import type { MeetingAvailability, SchedulingLink } from '../schemas/meeting-booking-schema';
import { availabilityWith, fillIdentity } from './fixtures/meeting-booking';

/** A slot two hours from now, on the hour — inside the month the calendar opens on. */
const SLOT_MS = Math.ceil((Date.now() + 2 * 3_600_000) / 3_600_000) * 3_600_000;
const availability: MeetingAvailability = {
  ...availabilityWith([]),
  durationsMs: [1_800_000, 2_700_000],
  slotsByDurationMs: { '1800000': [SLOT_MS], '2700000': [SLOT_MS] },
};

const book = vi.fn<(payload: Record<string, unknown>) => Promise<unknown>>();
const toast = vi.fn();

vi.mock('../hooks/use-meeting-booking', async importOriginal => ({
  ...(await importOriginal()),
  useMeetingBooking: () => ({
    availability,
    isLoadingAvailability: false,
    isFetchingAvailability: false,
    availabilityError: null,
    monthOffset: 0,
    setMonthOffset: vi.fn(),
    refetchAvailability: vi.fn(() => Promise.resolve()),
    book,
    isSubmitting: false,
  }),
}));
vi.mock('../hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const scheduler = (props: Partial<HubSpotMeetingSchedulerProps> = {}) => (
  <HubSpotMeetingScheduler meetingId="1" layout="modal" initialAvailability={availability} {...props} />
);

const timeChip = async () => {
  const chips = await waitFor(() => {
    const found = screen.getAllByRole('button').filter(b => /\d{1,2}:\d{2}/.test(b.textContent ?? ''));
    expect(found.length).toBeGreaterThan(0);
    return found;
  });
  return chips[0];
};

beforeEach(() => {
  availability.formFields = [];
  book.mockReset();
  toast.mockClear();
});

describe('HubSpotMeetingScheduler — modal layout', () => {
  it('a time is chosen, not submitted: Continue is what opens the form', async () => {
    render(scheduler());
    const next = screen.getByRole('button', { name: 'Continue' });
    expect(next).toBeDisabled();
    fireEvent.click(await timeChip());
    expect(screen.queryByLabelText(/^Email/)).not.toBeInTheDocument();
    expect(next).not.toBeDisabled();
    fireEvent.click(next);
    expect(await screen.findByLabelText(/^Email/)).toBeInTheDocument();
    expect(book).not.toHaveBeenCalled();
  });

  it('the length sits in the host strip as chips, and Back from the form returns to the calendar', async () => {
    render(scheduler());
    expect(screen.getByRole('button', { name: '30 min' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '45 min' })).toBeInTheDocument();
    expect(screen.getByText('Timezone')).toBeInTheDocument();
    fireEvent.click(await timeChip());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByLabelText(/^Email/);
    // Chosen: the chips give way to the length alone, and the timezone picker
    // stays with the calendar.
    expect(screen.queryByRole('button', { name: '45 min' })).not.toBeInTheDocument();
    expect(screen.getByText('30 min call')).toBeInTheDocument();
    expect(screen.queryByText('Timezone')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByLabelText(/^Email/)).not.toBeInTheDocument();
    expect(await timeChip()).toBeInTheDocument();
  });

  it('Cancel is the host exit beside Continue; without one there is no Cancel', () => {
    const onBack = vi.fn();
    const { unmount } = render(scheduler({ onBack }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
    render(scheduler());
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('on the form the footer carries Cancel and the submit, and the submit posts the form', async () => {
    book.mockResolvedValue({ ok: true, confirmation: { title: 'Call', startTimeMs: SLOT_MS, durationMs: 1_800_000 } });
    render(scheduler({ onBack: vi.fn() }));
    fireEvent.click(await timeChip());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByLabelText(/^Email/);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    // The submit is wired to the form by id, not nested in it: it sits in the footer under the card.
    const submit = screen.getByRole('button', { name: 'Confirm Booking' });
    expect(submit).toHaveAttribute('form');
    // Disabled until every answer would pass validation.
    expect(submit).toBeDisabled();
    fillIdentity();
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);
    await waitFor(() => expect(book).toHaveBeenCalledTimes(1));
    expect(book).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.co', startTimeMs: SLOT_MS }));
  });

  it('the card layout is untouched: a time click still opens the form at once', async () => {
    render(<HubSpotMeetingScheduler meetingId="1" initialAvailability={availability} />);
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    fireEvent.click(await timeChip());
    expect(await screen.findByLabelText(/^Email/)).toBeInTheDocument();
  });
});

const link: SchedulingLink = {
  id: '1',
  link: 'https://meetings.example.com/onboarding',
  slug: 'onboarding',
  purpose: 'openframe-users',
  title: 'Onboarding call',
  description: null,
  kind: 'personal',
  durationsMinutes: [30, 45],
  hosts: [],
  nextAvailableMs: SLOT_MS,
};

const bookingWindow = (props: Partial<MeetingSchedulerModalProps> = {}) => (
  <MeetingSchedulerModal isOpen onClose={vi.fn()} title="Book an Onboarding Call" link={link} {...props} />
);

describe('MeetingSchedulerModal', () => {
  it('is the titled window around the scheduler in its modal layout', async () => {
    render(bookingWindow());
    expect(screen.getByText('Book an Onboarding Call')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(await timeChip()).toBeInTheDocument();
  });

  it('with no link to book it says so instead of drawing the scheduler', () => {
    render(bookingWindow({ link: null, emptyMessage: 'No onboarding calls can be booked right now.' }));
    expect(screen.getByText('No onboarding calls can be booked right now.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('while the link is read the scheduler holds its place, not the empty line', () => {
    render(bookingWindow({ link: null, loading: true }));
    expect(screen.queryByText('No calls can be booked right now.')).not.toBeInTheDocument();
  });

  it('Cancel closes the window', () => {
    const onClose = vi.fn();
    render(bookingWindow({ onClose }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a confirmed booking toasts, reports the booking and closes the window', async () => {
    const confirmation = { meetingId: '1', title: 'Onboarding call', startTimeMs: SLOT_MS, durationMs: 1_800_000 };
    book.mockResolvedValue({ ok: true, confirmation });
    const onClose = vi.fn();
    const onBooked = vi.fn();
    render(bookingWindow({ onClose, onBooked }));
    fireEvent.click(await timeChip());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByLabelText(/^Email/);
    fillIdentity();
    const submit = screen.getByRole('button', { name: 'Confirm Booking' });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onBooked).toHaveBeenCalledWith(confirmation);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Call booked',
        variant: 'success',
        description: expect.stringContaining('Onboarding call - ') as unknown,
      }),
    );
  });
});
