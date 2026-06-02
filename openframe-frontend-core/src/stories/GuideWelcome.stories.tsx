import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { GuideWelcome } from '../components/chat/guide-welcome'
import { GuideModeBanner } from '../components/chat/guide-mode-banner'
import { MingoOnboardingCard } from '../components/chat/mingo-onboarding-card'
import {
  Rocket01Icon,
  CompassIcon,
  NewspaperIcon,
} from '../components/icons-v2-generated'

const ACTIONS = [
  { id: 'recent', label: 'Recent', onClick: () => console.log('recent') },
  { id: 'search', label: 'Search', onClick: () => console.log('search') },
  { id: 'find', label: 'Find', onClick: () => console.log('find') },
]

// Quick actions are caller-provided (GuideWelcome ships no defaults); these
// demonstrate the inline chips + the "⋯" overflow menu.
const SAMPLE_QUICK_ACTIONS = [
  { id: 'how-to-start', label: 'How to start' },
  { id: 'connect-device', label: 'Connect device' },
  { id: 'find-device', label: 'Find device' },
  { id: 'remote-connection', label: 'Remote connection' },
  { id: 'run-scripts', label: 'Run scripts' },
  { id: 'device-software', label: 'Device software' },
  { id: 'bulk-update', label: 'Bulk update' },
]

const SAMPLE_LIST = (
  <div className="shrink-0 overflow-hidden rounded-md border border-ods-border">
    <MingoOnboardingCard
      icon={<Rocket01Icon size={16} />}
      title="Product Releases"
      slashCommand="/release-notes"
      description="OpenFrame version releases, changelogs, and update notes"
      actions={ACTIONS}
    />
    <MingoOnboardingCard
      icon={<NewspaperIcon size={16} />}
      title="Blog Posts"
      slashCommand="/blogs"
      description="Latest articles, guides, and announcements from the blog"
      actions={ACTIONS}
    />
    <MingoOnboardingCard
      icon={<CompassIcon size={16} />}
      title="Onboarding Guides"
      slashCommand="/getting-started"
      description="Step-by-step guides to get started with OpenFrame"
      actions={ACTIONS}
    />
  </div>
)

const meta: Meta<typeof GuideWelcome> = {
  title: 'Chat/GuideWelcome',
  component: GuideWelcome,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Figma node `7532:328214`. Guide-mode chat empty state — a guide-mode banner, a centred greeting sharing one scroll region with the slash-command onboarding list, and a pinned quick-action chip row (overflowing to a "⋯" menu). Content is configurable with OpenFrame defaults.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    subtitle: { control: 'text' },
    quickActions: { control: false },
    onQuickAction: { control: false },
    children: { control: false },
  },
  decorators: [
    (Story) => (
      // Mimic the narrow drawer panel: dark `ods-bg` surface (the guide content
      // background), banner pinned at the top.
      <div className="flex h-[760px] w-[440px] flex-col overflow-hidden rounded-md border border-ods-border bg-ods-bg">
        <GuideModeBanner />
        <div className="flex flex-1 min-h-0 flex-col p-4">
          <Story />
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof GuideWelcome>

/** Full guide-mode empty state with the slash-command list and quick actions. */
export const Default: Story = {
  args: {
    quickActions: SAMPLE_QUICK_ACTIONS,
    onQuickAction: (a) => console.log('quick action', a.id),
    children: SAMPLE_LIST,
  },
}

/** No slash commands available yet — greeting + quick actions only. */
export const NoCommands: Story = {
  args: {
    quickActions: SAMPLE_QUICK_ACTIONS,
    onQuickAction: (a) => console.log('quick action', a.id),
  },
}

/** No quick actions supplied (the default) — the chip row is omitted entirely. */
export const NoQuickActions: Story = {
  args: {
    children: SAMPLE_LIST,
  },
}

/** Custom greeting copy. */
export const CustomCopy: Story = {
  args: {
    title: 'Ask the Guide',
    subtitle: 'A temporary session for exploring docs and tickets.',
    quickActions: SAMPLE_QUICK_ACTIONS,
    onQuickAction: (a) => console.log('quick action', a.id),
    children: SAMPLE_LIST,
  },
}
