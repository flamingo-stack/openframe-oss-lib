import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HubSpotMeetingScheduler, type HubSpotMeetingSchedulerProps } from '../components/meeting-scheduler';
import type { MeetingAvailability } from '../schemas/meeting-booking-schema';
import { availabilityWith } from './fixtures/meeting-booking';

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
    // Chosen: the chips give way to the length alone.
    expect(screen.queryByRole('button', { name: '45 min' })).not.toBeInTheDocument();
    expect(screen.getByText('30 min call')).toBeInTheDocument();
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

  it('the card layout is untouched: a time click still opens the form at once', async () => {
    render(<HubSpotMeetingScheduler meetingId="1" initialAvailability={availability} />);
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    fireEvent.click(await timeChip());
    expect(await screen.findByLabelText(/^Email/)).toBeInTheDocument();
  });
});
