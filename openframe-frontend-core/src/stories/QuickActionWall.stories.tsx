import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { QuickActionWall, interleave } from '../components/chat/quick-action-wall'
import type { QuickActionChip } from '../components/chat/chat-quick-action-row'

// A mixed IT/SEC stream (per-chip themes + lozenges) and a fae wall — the two
// wall registers: category-classified deck panels vs agent-themed hero walls.
const IT_ACTIONS: ReadonlyArray<QuickActionChip> = [
  { id: 'reset-password', label: 'Reset a password', icon: { name: 'key' }, theme: 'it' },
  { id: 'new-laptop', label: 'Provision a new laptop', icon: { name: 'laptop' }, theme: 'it' },
  { id: 'printer', label: 'Fix the printer', icon: { name: 'printer' }, theme: 'it' },
  { id: 'vpn', label: 'VPN will not connect', icon: { name: 'globe' }, theme: 'it' },
  { id: 'disk-full', label: 'Disk almost full', icon: { name: 'hard-drive' }, theme: 'it' },
  { id: 'onboard', label: 'Onboard a new hire', icon: { name: 'user-plus' }, theme: 'it' },
]

const SEC_ACTIONS: ReadonlyArray<QuickActionChip> = [
  { id: 'phishing', label: 'Phishing report triage', icon: { name: 'fish' }, theme: 'sec' },
  { id: 'mfa', label: 'Enforce MFA', icon: { name: 'shield-check' }, theme: 'sec' },
  { id: 'patch', label: 'Patch the CVE', icon: { name: 'bug' }, theme: 'sec' },
  { id: 'offboard', label: 'Revoke access on exit', icon: { name: 'user-minus' }, theme: 'sec' },
  { id: 'edr-alert', label: 'EDR alert review', icon: { name: 'radar' }, theme: 'sec' },
]

const FAE_ACTIONS: ReadonlyArray<QuickActionChip> = [
  { id: 'how-to-start', label: 'How to start', icon: { name: 'fae' } },
  { id: 'connect-device', label: 'Connect device', icon: { name: 'search' }, theme: 'fae' },
  { id: 'find-device', label: 'Find device', icon: { name: 'compass' }, theme: 'fae' },
  { id: 'remote-connection', label: 'Remote connection', icon: { name: 'rocket' }, theme: 'fae' },
  { id: 'run-scripts', label: 'Run scripts', icon: { name: 'bracket-curly' }, theme: 'fae' },
  { id: 'device-software', label: 'Device software', icon: { name: 'package' }, theme: 'fae' },
]

const meta: Meta<typeof QuickActionWall> = {
  title: 'Chat/QuickActionWall',
  component: QuickActionWall,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'THE quick-action chip wall: a themed pile of the shared chip on the shared `<MarqueeWall>` engine. Static-with-fade when content fits (or `prefers-reduced-motion`); an endless marquee when it overflows — the axis follows the fade (`bottom` fade → content travels bottom→top; `right` fade → right→left). Themes: `fae`/`mingo` (agent identities) and `it`/`sec` (classification pair, with lozenges). Interactive chips pause the track on hover; clone-copy chips stay clickable with wrapper-level a11y. `rows` renders the brick-wall mode (stacked independent row marquees).',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-ods-bg p-8">
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
    <div className="rounded-md border border-ods-border bg-ods-card p-4">
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
    <div className="rounded-md border border-ods-border bg-ods-card p-4">
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
    <div className="rounded-md border border-ods-border bg-ods-card p-4">
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
