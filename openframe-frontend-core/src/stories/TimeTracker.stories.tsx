import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import * as React from 'react'
import {
  TimeTrackerHeaderButton,
  TimeTrackerPanel,
  TimeTrackerProvider,
  type TimeTrackerData,
  type TimeTrackerEntry,
  type TimeTrackerStatus,
} from '../components/features/time-tracker'

// ---------------------------------------------------------------------------
// Mock data + a stand-in "host" that simulates the openframe-frontend backend
// (timer transitions, ticket search, persisting finished entries).
// ---------------------------------------------------------------------------

const ALL_TICKETS = [
  { id: 'TICK-101', label: '#101 · Printer not working' },
  { id: 'TICK-102', label: '#102 · VPN connection failed' },
  { id: 'TICK-103', label: '#103 · Outlook keeps crashing' },
  { id: 'TICK-104', label: '#104 · Disk Cleanup Assistance' },
  { id: 'TICK-105', label: '#105 · Wi-Fi dropping intermittently' },
  { id: 'TICK-106', label: '#106 · New employee laptop setup' },
  { id: 'TICK-107', label: '#107 · Two-factor authentication locked out' },
]

const SEED_ENTRIES: TimeTrackerEntry[] = [
  {
    id: 'e1',
    durationLabel: '00:08:17',
    dateLabel: '07/12/25',
    title: 'Disk Cleanup Assistance',
    description: 'Walked user through Storage Sense setup, scheduled monthly cleanup',
  },
  {
    id: 'e2',
    durationLabel: '00:23:04',
    dateLabel: '07/11/25',
    title: 'VPN connection failed',
    description: 'Reissued client certificate and verified split-tunnel routes',
  },
  {
    id: 'e3',
    durationLabel: '01:12:49',
    dateLabel: '07/10/25',
    title: 'New employee laptop setup',
    description: 'Imaged device, joined domain, installed standard software bundle',
  },
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

function formatDate(d: Date) {
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(-2)}`
}

const meta = {
  title: 'Features/TimeTracker',
  component: TimeTrackerPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Purely-UI time tracker. The host wraps the app in `<TimeTrackerProvider>` (supplying `status`, `runningSince`, ticket options, last entries, and the start/pause/resume/submit callbacks) and passes `showTimeTracker` to `AppHeader`. The header button shows the live elapsed time while a session is active and opens the popup below it. The timer is display-only — it ticks from the host-provided `runningSince`; the backend owns the real start time.',
      },
    },
  },
  // Default args satisfy the panel's required props for autodocs; every story
  // below overrides them with an interactive `render`.
  args: {
    status: 'ready',
    ticketOptions: ALL_TICKETS,
    selectedTicketIds: [],
    onSelectedTicketsChange: () => {},
    notes: '',
    onNotesChange: () => {},
    lastEntries: SEED_ENTRIES,
    onStart: () => {},
    onPause: () => {},
    onResume: () => {},
    onCancel: () => {},
    onSubmit: () => {},
    onClose: () => {},
  },
} satisfies Meta<typeof TimeTrackerPanel>

export default meta
type Story = StoryObj<typeof meta>

interface HostInit {
  status?: TimeTrackerStatus
  runningSince?: number | null
  accumulatedMs?: number
  selectedTicketIds?: string[]
  notes?: string
  lastEntries?: TimeTrackerEntry[]
  /** When true, ticket options are filtered asynchronously (server-search simulation). */
  serverSearch?: boolean
}

function useTimeTrackerHost(initial: HostInit = {}): TimeTrackerData {
  const [status, setStatus] = React.useState<TimeTrackerStatus>(initial.status ?? 'ready')
  const [runningSince, setRunningSince] = React.useState<number | null>(initial.runningSince ?? null)
  const [accumulatedMs, setAccumulatedMs] = React.useState(initial.accumulatedMs ?? 0)
  const [selectedTicketIds, setSelectedTicketIds] = React.useState<string[]>(initial.selectedTicketIds ?? [])
  const [notes, setNotes] = React.useState(initial.notes ?? '')
  const [lastEntries, setLastEntries] = React.useState<TimeTrackerEntry[]>(initial.lastEntries ?? SEED_ENTRIES)

  const [ticketOptions, setTicketOptions] = React.useState(ALL_TICKETS)
  const [ticketsLoading, setTicketsLoading] = React.useState(false)
  const searchRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const currentElapsedMs = () =>
    accumulatedMs + (status === 'tracking' && runningSince ? Date.now() - runningSince : 0)

  const onTicketSearch = initial.serverSearch
    ? (query: string) => {
        setTicketsLoading(true)
        clearTimeout(searchRef.current)
        searchRef.current = setTimeout(() => {
          const q = query.toLowerCase()
          setTicketOptions(ALL_TICKETS.filter((t) => t.label.toLowerCase().includes(q)))
          setTicketsLoading(false)
        }, 350)
      }
    : undefined

  return {
    status,
    runningSince,
    accumulatedMs,
    ticketOptions,
    selectedTicketIds,
    onSelectedTicketsChange: setSelectedTicketIds,
    onTicketSearch,
    ticketsLoading: initial.serverSearch ? ticketsLoading : undefined,
    notes,
    onNotesChange: setNotes,
    lastEntries,
    onStart: () => {
      setAccumulatedMs(0)
      setRunningSince(Date.now())
      setStatus('tracking')
    },
    onPause: () => {
      setAccumulatedMs(currentElapsedMs())
      setRunningSince(null)
      setStatus('paused')
    },
    onResume: () => {
      setRunningSince(Date.now())
      setStatus('tracking')
    },
    onCancel: () => {
      setStatus('ready')
      setRunningSince(null)
      setAccumulatedMs(0)
      setSelectedTicketIds([])
      setNotes('')
    },
    onSubmit: () => {
      const ms = currentElapsedMs()
      const ticketId = selectedTicketIds[0]
      const entry: TimeTrackerEntry = {
        id: `entry-${Date.now()}`,
        durationLabel: formatDuration(ms),
        dateLabel: formatDate(new Date()),
        title: ticketId
          ? ALL_TICKETS.find((t) => t.id === ticketId)?.label ?? ticketId
          : 'Manual time entry',
        description: notes || undefined,
      }
      setLastEntries((prev) => [entry, ...prev].slice(0, 3))
      setStatus('ready')
      setRunningSince(null)
      setAccumulatedMs(0)
      setSelectedTicketIds([])
      setNotes('')
    },
    onManualEntry: () => alert('Host: open the manual-entry form modal'),
    onOpenMyTime: () => alert('Host: navigate to "My Time"'),
    onOpenMyTimeMenu: () => alert('Host: open the "My Time" split menu'),
    onEntryClick: (entry) => alert(`Host: navigate to entry "${entry.title}"`),
  }
}

/** Mock header strip so the `HeaderButton` resolves its `h-full` and the popover anchors correctly. */
function HeaderBar() {
  return (
    <div className="flex h-14 w-full items-center justify-end border-b border-ods-border bg-ods-card divide-x divide-ods-border">
      <TimeTrackerHeaderButton />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel stories — the popup content in each status. Fully interactive: the
// play/pause/stop buttons drive the same transitions the host would.
// ---------------------------------------------------------------------------

/** Idle. Stop button is hidden until tracking starts; pre-seeded last entries. */
export const PanelReady: Story = {
  render: function PanelReadyRender() {
    const host = useTimeTrackerHost({ status: 'ready' })
    return (
      <div className="max-w-[460px]">
        <TimeTrackerPanel {...host} onClose={() => {}} />
      </div>
    )
  },
}

/** Tracking — the timer ticks live and a ticket is selected, so Stop (finish) is enabled. */
export const PanelTracking: Story = {
  render: function PanelTrackingRender() {
    const host = useTimeTrackerHost({
      status: 'tracking',
      runningSince: Date.now() - 5_000,
      selectedTicketIds: ['TICK-102'],
    })
    return (
      <div className="max-w-[460px]">
        <TimeTrackerPanel {...host} onClose={() => {}} />
      </div>
    )
  },
}

/** Paused at 00:08:17 with notes filled — Stop (finish) is enabled via the notes rule. */
export const PanelPaused: Story = {
  render: function PanelPausedRender() {
    const host = useTimeTrackerHost({
      status: 'paused',
      accumulatedMs: 497_000,
      notes: 'Walked user through Storage Sense setup, scheduled monthly cleanup.',
    })
    return (
      <div className="max-w-[460px]">
        <TimeTrackerPanel {...host} onClose={() => {}} />
      </div>
    )
  },
}

/**
 * Tracking with no ticket and no notes — pressing Finish (the yellow check) surfaces inline
 * validation errors on both fields instead of submitting. Add a ticket or a note and Finish succeeds.
 */
export const PanelFinishGate: Story = {
  render: function PanelFinishGateRender() {
    const host = useTimeTrackerHost({ status: 'tracking', runningSince: Date.now() - 42_000 })
    return (
      <div className="max-w-[460px]">
        <TimeTrackerPanel {...host} onClose={() => {}} />
      </div>
    )
  },
}

/** Empty last-entries state. */
export const PanelNoEntries: Story = {
  render: function PanelNoEntriesRender() {
    const host = useTimeTrackerHost({ status: 'ready', lastEntries: [] })
    return (
      <div className="max-w-[460px]">
        <TimeTrackerPanel {...host} onClose={() => {}} />
      </div>
    )
  },
}

// ---------------------------------------------------------------------------
// Header button stories — the trigger as it appears in the app header.
// ---------------------------------------------------------------------------

/** Idle header button — clock icon only. Click it to open the popup. */
export const HeaderButtonIdle: Story = {
  parameters: { layout: 'fullscreen' },
  render: function HeaderButtonIdleRender() {
    const host = useTimeTrackerHost({ status: 'ready' })
    return (
      <TimeTrackerProvider {...host}>
        <HeaderBar />
        <p className="p-4 text-h6 text-ods-text-secondary">Click the clock icon to open the time tracker.</p>
      </TimeTrackerProvider>
    )
  },
}

/** Active header button — shows the live elapsed time next to the clock icon. */
export const HeaderButtonTracking: Story = {
  parameters: { layout: 'fullscreen' },
  render: function HeaderButtonTrackingRender() {
    const host = useTimeTrackerHost({ status: 'tracking', runningSince: Date.now() - 65_000 })
    return (
      <TimeTrackerProvider {...host}>
        <HeaderBar />
        <p className="p-4 text-h6 text-ods-text-secondary">
          While tracking, the header shows the running timer. Click it to open the popup.
        </p>
      </TimeTrackerProvider>
    )
  },
}

/** Paused header button — clock icon and timer are greyed out (frozen elapsed time). */
export const HeaderButtonPaused: Story = {
  parameters: { layout: 'fullscreen' },
  render: function HeaderButtonPausedRender() {
    const host = useTimeTrackerHost({ status: 'paused', accumulatedMs: 65_000 })
    return (
      <TimeTrackerProvider {...host}>
        <HeaderBar />
        <p className="p-4 text-h6 text-ods-text-secondary">
          While paused, the clock and timer are muted to signal the session is on hold.
        </p>
      </TimeTrackerProvider>
    )
  },
}

// ---------------------------------------------------------------------------
// Full interactive playground — provider + header button + simulated server
// ticket search + real start/pause/resume/finish that persists into Last Entries.
// ---------------------------------------------------------------------------

export const Playground: Story = {
  parameters: { layout: 'fullscreen' },
  render: function PlaygroundRender() {
    const host = useTimeTrackerHost({ serverSearch: true })
    return (
      <TimeTrackerProvider {...host}>
        <HeaderBar />
        <div className="max-w-xl p-4">
          <p className="text-h3 text-ods-text-primary">Time tracker playground</p>
          <ul className="mt-2 list-disc pl-5 text-h6 text-ods-text-secondary">
            <li>Open the popup from the clock button in the header above.</li>
            <li>Press play to start; the header and panel timers tick from the start time.</li>
            <li>Typing in “Assign Ticket” runs a simulated async search (loading spinner).</li>
            <li>Stop is disabled until you pick a ticket or type a note.</li>
            <li>Finishing pushes a new row into Last Entries (capped at 3) and resets to idle.</li>
          </ul>
        </div>
      </TimeTrackerProvider>
    )
  },
}
