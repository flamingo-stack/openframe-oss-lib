export type TimeTrackerStatus = 'ready' | 'tracking' | 'paused'

export interface TimeTrackerTicketOption {
  id: string
  label: string
}

export interface TimeTrackerEntry {
  id: string
  /** Pre-formatted duration label, e.g. "00:08:17" (host formats it). */
  durationLabel: string
  /** Pre-formatted date label, e.g. "07/12/25". */
  dateLabel: string
  title: string
  description?: string
}

/**
 * Everything the host feeds into the purely-UI time tracker.
 * The UI never performs API calls or owns business state — it renders `status` and
 * the live timer (derived from `runningSince` + `accumulatedMs`) and emits callbacks.
 */
export interface TimeTrackerData {
  status: TimeTrackerStatus
  /**
   * Epoch ms when the current running segment started. Only meaningful while
   * `status === 'tracking'`. The UI ticks a local interval to display elapsed time
   * from this value — the backend remains the source of truth.
   */
  runningSince?: number | null
  /** Elapsed ms accrued before the current running segment (paused/resumed sessions). */
  accumulatedMs?: number

  ticketOptions: TimeTrackerTicketOption[]
  selectedTicketIds: string[]
  onSelectedTicketsChange: (ids: string[]) => void
  /** Called as the user types in the ticket field; host performs the search. */
  onTicketSearch?: (query: string) => void
  ticketsLoading?: boolean

  notes: string
  onNotesChange: (value: string) => void

  /** Previous tracked sessions; the UI renders at most three. */
  lastEntries: TimeTrackerEntry[]

  onStart: () => void
  onPause: () => void
  onResume: () => void
  /** Discard the in-progress session entirely (reset to idle). Shown while tracking/paused. */
  onCancel: () => void
  /** Finish the session. The UI only enables this once at least one field is filled. */
  onSubmit: () => void
  onManualEntry?: () => void
  onOpenMyTime?: () => void
  onOpenMyTimeMenu?: () => void
  onEntryClick?: (entry: TimeTrackerEntry) => void

  isStarting?: boolean
  isSubmitting?: boolean
}
