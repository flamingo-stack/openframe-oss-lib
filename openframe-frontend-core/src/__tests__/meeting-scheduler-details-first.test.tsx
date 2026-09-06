import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HubSpotMeetingScheduler } from '../components/meeting-scheduler';
import type { MeetingAvailability } from '../schemas/meeting-booking-schema';
import { availabilityWith, fillIdentity } from './fixtures/meeting-booking';

/** A slot two hours from now, on the hour — inside the month the calendar opens on. */
const SLOT_MS = Math.ceil((Date.now() + 2 * 3_600_000) / 3_600_000) * 3_600_000;
const availability: MeetingAvailability = {
  ...availabilityWith([]),
  slotsByDurationMs: { '1800000': [SLOT_MS] },
};

const book = vi.fn<(payload: Record<string, unknown>) => Promise<unknown>>();
const refetchAvailability = vi.fn(() => Promise.resolve());
const toast = vi.fn();

vi.mock('../hooks/use-meeting-booking', async importOriginal => ({
  // The sentinel keeps its ONE owner: only the hook itself is replaced.
  ...((await importOriginal()) as Record<string, unknown>),
  useMeetingBooking: () => ({
    availability,
    isLoadingAvailability: false,
    isFetchingAvailability: false,
    availabilityError: null,
    monthOffset: 0,
    setMonthOffset: vi.fn(),
    refetchAvailability,
    book,
    isSubmitting: false,
  }),
}));
vi.mock('../hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

async function continueFromDetails() {
  render(<HubSpotMeetingScheduler meetingId="1" flow="details-first" initialAvailability={availability} />);
  await screen.findByLabelText(/^Email/);
  fillIdentity();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  // The calendar step: Back exists here (it never does on the form step).
  await screen.findByRole('button', { name: 'Back' });
  expect(screen.queryByLabelText(/^Email/)).not.toBeInTheDocument();
}

const timeChip = async () => {
  const chips = await waitFor(() => {
    const found = screen.getAllByRole('button').filter(b => /\d{1,2}:\d{2}/.test(b.textContent ?? ''));
    expect(found.length).toBeGreaterThan(0);
    return found;
  });
  return chips[0];
};

beforeEach(() => {
  book.mockReset();
  refetchAvailability.mockClear();
  toast.mockClear();
});

describe('HubSpotMeetingScheduler — details-first flow', () => {
  it('Continue moves to the calendar without posting; Back restores every answer', async () => {
    await continueFromDetails();
    expect(book).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByLabelText(/^Email/)).toHaveValue('a@b.co');
    expect(screen.getByLabelText(/^First Name/)).toHaveValue('Ada');
  });

  it('the slot click IS the submit: the frozen details ride with the chip’s instant', async () => {
    book.mockResolvedValue({ ok: false, code: 'SLOT_TAKEN' });
    await continueFromDetails();
    fireEvent.click(await timeChip());
    await waitFor(() => expect(book).toHaveBeenCalledTimes(1));
    expect(book).toHaveBeenCalledWith(
      expect.objectContaining({ meetingId: '1', email: 'a@b.co', firstName: 'Ada', startTimeMs: SLOT_MS }),
    );
    // SLOT_TAKEN keeps the visitor on the calendar and refreshes it.
    await waitFor(() => expect(refetchAvailability).toHaveBeenCalled());
    expect(screen.queryByLabelText(/^Email/)).not.toBeInTheDocument();
  });

  it('VALIDATION sends the visitor back to a populated form and says why', async () => {
    book.mockResolvedValue({ ok: false, code: 'VALIDATION' });
    await continueFromDetails();
    fireEvent.click(await timeChip());
    expect(await screen.findByLabelText(/^Email/)).toHaveValue('a@b.co');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Booking failed' }));
  });
});
