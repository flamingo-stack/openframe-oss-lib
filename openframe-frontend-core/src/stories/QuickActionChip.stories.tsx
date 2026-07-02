import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import {
  QuickActionChipButton,
  type QuickActionIconSpec,
} from '../components/chat/quick-action-chip'

const meta: Meta<typeof QuickActionChipButton> = {
  title: 'Chat/QuickActionChip',
  component: QuickActionChipButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The unified quick-action chip (`QuickActionChipButton`) used by every chat empty state (guide / mingo / ai-agent), the marketing marquee strips, and the ROI table task cells. Icon resolution is owned entirely by `<EntityIcon>` in two `QuickActionIconSpec` formats: the **agent format** (`{ name: \'fae\' | \'mingo\' }`) renders the packaged agent mark, and the **config format** (`{ name, url, props, accent }`) renders an admin-configured glyph tinted via `accent` (`pink` → flamingo-pink, `cyan` → flamingo-cyan, or any CSS color). An explicit `props.color` wins over `accent`.',
      },
    },
  },
  argTypes: {
    label: { control: 'text' },
    variant: { control: 'inline-radio', options: ['outline', 'primary'] },
    interactive: { control: 'boolean' },
    icon: { control: false },
    onSelect: { control: false },
    onHoverStart: { control: false },
    onHoverEnd: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center bg-ods-bg p-8">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof QuickActionChipButton>

// Config-format icon specs — resolved by <EntityIcon> against the icons-v2
// library, tinted by `accent`.
const SEARCH_ICON: QuickActionIconSpec = { name: 'search', accent: 'pink' }
const BUG_ICON: QuickActionIconSpec = { name: 'bug', accent: 'cyan' }

/** Default bordered (`outline`) chip with a config glyph tinted flamingo-pink. */
export const Default: Story = {
  args: {
    label: 'How to start',
    icon: SEARCH_ICON,
    variant: 'outline',
    onSelect: () => console.log('select'),
  },
}

/** Accent (`primary`, yellow) chip variant. */
export const Primary: Story = {
  args: {
    label: 'Run scripts',
    icon: { name: 'rocket' },
    variant: 'primary',
    onSelect: () => console.log('select'),
  },
}

/** Config glyphs tinted via `accent` — `pink` and `cyan` brand tokens. */
export const AccentTints: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <QuickActionChipButton label="Search docs" icon={SEARCH_ICON} onSelect={() => {}} />
      <QuickActionChipButton label="Report a bug" icon={BUG_ICON} onSelect={() => {}} />
      <QuickActionChipButton
        label="Custom color"
        icon={{ name: 'compass', accent: '#8b5cf6' }}
        onSelect={() => {}}
      />
    </div>
  ),
}

/**
 * Agent-format icons — `{ name: 'fae' }` / `{ name: 'mingo' }` render the
 * packaged agent marks (they carry their own colors; `accent` is ignored).
 */
export const AgentMarks: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <QuickActionChipButton label="Ask fae" icon={{ name: 'fae' }} onSelect={() => {}} />
      <QuickActionChipButton label="Ask mingo" icon={{ name: 'mingo' }} onSelect={() => {}} />
    </div>
  ),
}

/** No icon — label only. */
export const NoIcon: Story = {
  args: {
    label: 'Find device',
    onSelect: () => console.log('select'),
  },
}

/**
 * `interactive={false}` renders a plain, non-focusable `<Tag>` (decorative use:
 * marquee strips, ROI table cells) — no button, no hover callbacks.
 */
export const NonInteractive: Story = {
  args: {
    label: 'Decorative',
    icon: SEARCH_ICON,
    interactive: false,
  },
}

/**
 * `onHoverStart` / `onHoverEnd` fire on pointer AND keyboard focus — used to
 * preview the full prompt in the composer, then restore it. Hover or tab the
 * chip and watch the Actions/console panel.
 */
export const HoverCallbacks: Story = {
  args: {
    label: 'Preview prompt',
    icon: { name: 'fae' },
    onSelect: () => console.log('select'),
    onHoverStart: () => console.log('hover start → preview prompt'),
    onHoverEnd: () => console.log('hover end → restore composer'),
  },
}

/** All variants side by side. */
export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <QuickActionChipButton label="Outline" icon={SEARCH_ICON} onSelect={() => {}} />
        <QuickActionChipButton
          label="Primary"
          icon={{ name: 'rocket' }}
          variant="primary"
          onSelect={() => {}}
        />
        <QuickActionChipButton label="No icon" onSelect={() => {}} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <QuickActionChipButton label="fae" icon={{ name: 'fae' }} onSelect={() => {}} />
        <QuickActionChipButton label="mingo" icon={{ name: 'mingo' }} onSelect={() => {}} />
        <QuickActionChipButton label="Decorative" icon={BUG_ICON} interactive={false} />
      </div>
    </div>
  ),
}
