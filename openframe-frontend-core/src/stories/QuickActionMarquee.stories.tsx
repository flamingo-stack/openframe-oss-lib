import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import {
  QuickActionMarquee,
  type QuickActionMarqueeItem,
} from '../components/chat/quick-action-marquee'

// fae-row items (config glyphs tinted pink) and mingo-row items (tinted cyan) —
// mirrors the Figma fae/mingo marquee rows.
const FAE_ITEMS: ReadonlyArray<QuickActionMarqueeItem> = [
  { id: 'how-to-start', label: 'How to start', icon: { name: 'fae' } },
  { id: 'connect-device', label: 'Connect device', icon: { name: 'search', accent: 'pink' } },
  { id: 'find-device', label: 'Find device', icon: { name: 'compass', accent: 'pink' } },
  { id: 'remote-connection', label: 'Remote connection', icon: { name: 'rocket', accent: 'pink' } },
  { id: 'run-scripts', label: 'Run scripts', icon: { name: 'bracket-curly', accent: 'pink' } },
  { id: 'device-software', label: 'Device software', icon: { name: 'package', accent: 'pink' } },
]

const MINGO_ITEMS: ReadonlyArray<QuickActionMarqueeItem> = [
  { id: 'roi', label: 'Calculate ROI', icon: { name: 'mingo' } },
  { id: 'ticket', label: 'Open ticket', icon: { name: 'ticket', accent: 'cyan' } },
  { id: 'report-bug', label: 'Report a bug', icon: { name: 'bug', accent: 'cyan' } },
  { id: 'docs', label: 'Read docs', icon: { name: 'book', accent: 'cyan' } },
  { id: 'chat', label: 'Start a chat', icon: { name: 'chats', accent: 'cyan' } },
  { id: 'news', label: "What's new", icon: { name: 'newspaper', accent: 'cyan' } },
]

const meta: Meta<typeof QuickActionMarquee> = {
  title: 'Chat/QuickActionMarquee',
  component: QuickActionMarquee,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Endless horizontally-scrolling strip of quick-action chips (Figma fae/mingo marquee rows). The item list is padded to ≥6 chips and rendered twice so the `qa-marquee` keyframe’s `translateX(-50%)` loops seamlessly; the duplicate half is `aria-hidden` and never focusable. Pauses on hover (`pauseOnHover`, default on) and always under `prefers-reduced-motion`. Pass `onSelect` to make chips interactive buttons; omit it for a purely decorative strip.',
      },
    },
  },
  argTypes: {
    items: { control: false },
    direction: { control: 'inline-radio', options: ['left', 'right'] },
    duration: { control: { type: 'number', min: 5, max: 120, step: 5 } },
    pauseOnHover: { control: 'boolean' },
    onSelect: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="bg-ods-bg py-8">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof QuickActionMarquee>

/** Single fae row scrolling left, interactive chips. */
export const Default: Story = {
  args: {
    items: FAE_ITEMS,
    onSelect: (item) => console.log('select', item.id),
  },
}

/** The two Figma rows: fae (left) over mingo (right, reversed). */
export const TwoRows: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <QuickActionMarquee items={FAE_ITEMS} direction="left" onSelect={(i) => console.log(i.id)} />
      <QuickActionMarquee items={MINGO_ITEMS} direction="right" onSelect={(i) => console.log(i.id)} />
    </div>
  ),
}

/** Reversed scroll direction. */
export const ScrollRight: Story = {
  args: {
    items: MINGO_ITEMS,
    direction: 'right',
    onSelect: (item) => console.log('select', item.id),
  },
}

/**
 * No `onSelect` → chips render as plain, non-focusable tags (decorative
 * marketing strip). Nothing is clickable or tabbable.
 */
export const Decorative: Story = {
  args: {
    items: FAE_ITEMS,
  },
}

/**
 * Fewer than 6 items — the track is auto-repeated up to the `MIN_TRACK_ITEMS`
 * heuristic so the halved loop still fills the viewport with no visible gap.
 */
export const FewItems: Story = {
  args: {
    items: FAE_ITEMS.slice(0, 2),
    onSelect: (item) => console.log('select', item.id),
  },
}

/** Faster loop (`duration={15}`) and hover-pause disabled. */
export const FastNoPause: Story = {
  args: {
    items: FAE_ITEMS,
    duration: 15,
    pauseOnHover: false,
    onSelect: (item) => console.log('select', item.id),
  },
}
