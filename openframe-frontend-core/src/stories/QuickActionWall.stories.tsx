import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { QuickActionWall, interleave } from '../components/chat/quick-action-wall'
import type { QuickActionChip, QuickActionThemeSpec } from '../components/chat/quick-action-chip'

// Theme specs are CALLER-supplied (the lib ships no registry, no fallbacks):
// these are this story's own demo specs — real consumers resolve agent
// accents from server config and define their own category pairs.
const IT_THEME: QuickActionThemeSpec = {
  accent: 'var(--color-warning)',
  lozenge: { label: 'IT', className: 'text-ods-warning' },
}
const SEC_THEME: QuickActionThemeSpec = {
  accent: 'var(--color-error)',
  lozenge: { label: 'SEC', className: 'text-ods-error' },
}
const FAE_THEME: QuickActionThemeSpec = { accent: 'pink' }

// A mixed IT/SEC stream (per-chip themes + lozenges) and a fae wall — the two
// wall registers: category-classified deck panels vs agent-themed hero walls.
const IT_ACTIONS: ReadonlyArray<QuickActionChip> = [
  { id: 'reset-password', label: 'Reset a password', icon: { name: 'key' }, theme: IT_THEME },
  { id: 'new-laptop', label: 'Provision a new laptop', icon: { name: 'laptop' }, theme: IT_THEME },
  { id: 'printer', label: 'Fix the printer', icon: { name: 'printer' }, theme: IT_THEME },
  { id: 'vpn', label: 'VPN will not connect', icon: { name: 'globe' }, theme: IT_THEME },
  { id: 'disk-full', label: 'Disk almost full', icon: { name: 'hard-drive' }, theme: IT_THEME },
  { id: 'onboard', label: 'Onboard a new hire', icon: { name: 'user-plus' }, theme: IT_THEME },
]

const SEC_ACTIONS: ReadonlyArray<QuickActionChip> = [
  { id: 'phishing', label: 'Phishing report triage', icon: { name: 'fish' }, theme: SEC_THEME },
  { id: 'mfa', label: 'Enforce MFA', icon: { name: 'shield-check' }, theme: SEC_THEME },
  { id: 'patch', label: 'Patch the CVE', icon: { name: 'bug' }, theme: SEC_THEME },
  { id: 'offboard', label: 'Revoke access on exit', icon: { name: 'user-minus' }, theme: SEC_THEME },
  { id: 'edr-alert', label: 'EDR alert review', icon: { name: 'radar' }, theme: SEC_THEME },
]

const FAE_ACTIONS: ReadonlyArray<QuickActionChip> = [
  { id: 'how-to-start', label: 'How to start', icon: { name: 'fae' } },
  { id: 'connect-device', label: 'Connect device', icon: { name: 'search' }, theme: FAE_THEME },
  { id: 'find-device', label: 'Find device', icon: { name: 'compass' }, theme: FAE_THEME },
  { id: 'remote-connection', label: 'Remote connection', icon: { name: 'rocket' }, theme: FAE_THEME },
  { id: 'run-scripts', label: 'Run scripts', icon: { name: 'bracket-curly' }, theme: FAE_THEME },
  { id: 'device-software', label: 'Device software', icon: { name: 'package' }, theme: FAE_THEME },
]

const meta: Meta<typeof QuickActionWall> = {
  title: 'Chat/QuickActionWall',
  component: QuickActionWall,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'THE quick-action chip wall: a themed pile of the shared chip on the shared `<MarqueeWall>` engine. Static-with-fade when content fits (or `prefers-reduced-motion`); an endless marquee when it overflows — the axis follows the fade (`bottom` fade → content travels bottom→top; `right` fade → right→left). Theme specs (accent + optional lozenge) are caller-supplied per chip or as a wall default — the lib ships no theme registry. Interactive chips pause the track on hover; clone-copy chips stay clickable with wrapper-level a11y. `rows` renders the brick-wall mode (stacked independent row marquees).',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-ods-bg p-[var(--spacing-system-xl)]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof QuickActionWall>

/** Vertical wall (bottom fade → bottom→top marquee): the deck-panel register —
 *  mixed IT/SEC stream with lozenges, decorative chips. */
export const VerticalMixedStream: Story = {
  render: () => (
    <div className="rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]">
      <QuickActionWall
        chips={interleave(IT_ACTIONS, SEC_ACTIONS)}
        lozenges
        fade="bottom"
        fadeColor="var(--color-bg-card)"
        className="max-h-[180px]"
      />
    </div>
  ),
}

/** Horizontal wall (right fade): the hero-tab register — a wide fae wall
 *  drifting right→left, interactive chips (hover pauses the track). */
export const HorizontalInteractive: Story = {
  render: () => (
    <QuickActionWall
      chips={FAE_ACTIONS.map((c, i) => ({ ...c, selected: i === 0, selectedAccent: 'pink', onSelect: () => console.log(c.id) }))}
      fade="right"
      className="w-full"
      contentClassName="w-[1400px]"
    />
  ),
}

/** Plain mode — the consumer's opt-out: same chips and layout, no marquee,
 *  no blur. */
export const Plain: Story = {
  render: () => (
    <div className="rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]">
      <QuickActionWall
        chips={interleave(IT_ACTIONS, SEC_ACTIONS)}
        mode="plain"
        lozenges
        className="max-h-[180px]"
      />
    </div>
  ),
}

/** Loading: skeleton chips (1:1 geometry, lozenge slots reserved) — static
 *  until real chips land. */
export const Loading: Story = {
  render: () => (
    <div className="rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]">
      <QuickActionWall
        chips={[]}
        loading
        lozenges
        fade="bottom"
        fadeColor="var(--color-bg-card)"
        className="max-h-[180px]"
      />
    </div>
  ),
}

// Brick-mode chip set: enough distinct actions to fill more than two full
// courses, so the agent cap and the even split are both visible.
const BRICK_ACTIONS: ReadonlyArray<QuickActionChip> = [
  ...IT_ACTIONS,
  ...SEC_ACTIONS,
  ...FAE_ACTIONS.map((c) => ({ ...c, theme: FAE_THEME })),
].map((c) => ({ ...c, onSelect: () => console.log(c.id) }))

/** Brick, chat agent (`agentSlug="mingo"`): the stack grows with the chip
 *  supply but caps at 2 rows. Originals are split evenly across the two rows
 *  first, then each row pads to a full course — no row is all-duplicates. */
export const BrickAgentCapped: Story = {
  render: () => (
    <QuickActionWall
      chips={BRICK_ACTIONS}
      agentSlug="mingo"
      rows={4}
      pauseOnHover
      dragScroll
      fade={['left', 'right']}
      fadeSize={{ left: 32 }}
      fadeColor="var(--color-bg)"
      copyGap="var(--spacing-system-xxs)"
      className="max-h-44"
    />
  ),
}

/** Brick, few actions (`agentSlug="fae"`, 3 chips): fewer than one course, so
 *  the stack collapses to a SINGLE row padded with its own repeats instead of
 *  spreading one chip per row. */
export const BrickFewActions: Story = {
  render: () => (
    <QuickActionWall
      chips={FAE_ACTIONS.slice(0, 3).map((c) => ({ ...c, theme: FAE_THEME, onSelect: () => console.log(c.id) }))}
      agentSlug="fae"
      rows={4}
      pauseOnHover
      dragScroll
      fade={['left', 'right']}
      fadeSize={{ left: 32 }}
      fadeColor="var(--color-bg)"
      copyGap="var(--spacing-system-xxs)"
      className="max-h-44"
    />
  ),
}

/** Brick, narrow composer: the per-row pad target adapts to the measured
 *  container width, so a chat-composer-width wall repeats each action only as
 *  many times as it takes to overflow (far fewer duplicates than the fixed
 *  14), while a wide wall keeps the full course. Constrained to ~420px here to
 *  show the reduced duplication. */
export const BrickNarrowComposer: Story = {
  render: () => (
    <div className="w-[420px] max-w-full rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]">
      <QuickActionWall
        chips={FAE_ACTIONS.slice(0, 3).map((c) => ({ ...c, theme: FAE_THEME, onSelect: () => console.log(c.id) }))}
        agentSlug="fae"
        rows={4}
        pauseOnHover
        dragScroll
        fade={['left', 'right']}
        fadeSize={{ left: 32 }}
        fadeColor="var(--color-bg-card)"
        copyGap="var(--spacing-system-xxs)"
        className="max-h-44"
      />
    </div>
  ),
}

/** Brick, non-agent (no `agentSlug`): keeps exactly `rows` rows (marketing /
 *  onboarding walls are sized for their design), still getting the even split
 *  so a row is never filled with only one repeated chip. */
export const BrickNonAgent: Story = {
  render: () => (
    <QuickActionWall
      chips={BRICK_ACTIONS}
      rows={4}
      fade={['left', 'right']}
      fadeSize={{ left: 32 }}
      fadeColor="var(--color-bg)"
      copyGap="var(--spacing-system-xxs)"
      className="max-h-56"
    />
  ),
}
