import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MingoOnboardingCard } from '../components/chat/mingo-onboarding-card'
import { resolveOnboardingIcon } from '../components/chat/utils/onboarding-icons'
import { ClickupLogoGreyIcon } from '../components/icons-v2-generated/brand-logos/clickup-logo-grey-icon'
import { CompassIcon } from '../components/icons-v2-generated/map-and-travel/compass-icon'
import { Rocket02Icon } from '../components/icons-v2-generated/vehicles-and-delivery/rocket-02-icon'
import { BracketCurlyIcon } from '../components/icons-v2-generated/coding/bracket-curly-icon'
import { ChatsIcon } from '../components/icons-v2-generated/communication/chats-icon'

const meta: Meta<typeof MingoOnboardingCard> = {
  title: 'Chat/MingoOnboardingCard',
  component: MingoOnboardingCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Figma node `7363:205939`. Single row card used inside the chat empty-state list. Stacks vertically inside a `rounded-md` container — the bottom border on each card forms a 1-px divider between siblings (collapsed on the last row via `last:border-b-0`).',
      },
    },
  },
  argTypes: {
    icon: { control: false },
    onClick: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-[520px] bg-ods-bg p-4 rounded-md border border-ods-border">
        <div className="overflow-hidden rounded-md border border-ods-border">
          <Story />
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

// =============================================================================
// Single-card examples — icons are pulled directly from `icons-v2-generated`
// (monochrome glyphs; tint via the card's `text-ods-text-secondary` slot).
// =============================================================================

export const Default: Story = {
  args: {
    icon: <CompassIcon size={16} />,
    title: 'ClickUp Roadmap',
    slashCommand: '/roadmap',
    description: 'Public product roadmap with upcoming features and releases',
  },
}

export const WithoutDescription: Story = {
  args: {
    icon: <CompassIcon size={16} />,
    title: 'ClickUp Roadmap',
    slashCommand: '/roadmap',
  },
}

export const WithoutSlashCommand: Story = {
  args: {
    icon: <Rocket02Icon size={16} />,
    title: 'Get started',
    description: 'Browse onboarding guides and quick wins',
  },
}

export const LongTitleTruncates: Story = {
  args: {
    icon: <BracketCurlyIcon size={16} />,
    title: 'Some Really Long Repository Name That Should Truncate Cleanly',
    slashCommand: '/very-long-slash-command-name',
    description: 'Description for the truncating row.',
  },
}

export const Clickable: Story = {
  args: {
    icon: <ChatsIcon size={16} />,
    title: 'OpenMSP Community',
    slashCommand: '/slack',
    description: 'Messages and discussions from the OpenMSP community Slack',
    onClick: () => {
      // eslint-disable-next-line no-console
      console.log('[story] card clicked')
    },
  },
}

export const WithActions: Story = {
  args: {
    icon: <CompassIcon size={16} />,
    title: 'ClickUp Roadmap',
    slashCommand: '/roadmap',
    description: 'Public product roadmap with upcoming features and releases',
    actions: [
      {
        id: 'recent',
        label: 'Recent',
        onClick: () => {
          // eslint-disable-next-line no-console
          console.log('[story] recent clicked')
        },
      },
      {
        id: 'search',
        label: 'Search',
        onClick: () => {
          // eslint-disable-next-line no-console
          console.log('[story] search clicked')
        },
      },
      {
        id: 'find',
        label: 'Find',
        onClick: () => {
          // eslint-disable-next-line no-console
          console.log('[story] find clicked')
        },
      },
    ],
  },
}

// =============================================================================
// Stack of `chipCommands` — mirrors Figma node 7363:205938 (full empty-state).
// Icons are resolved via the shared `resolveOnboardingIcon` registry so the
// story stays in sync with the chat's runtime mapping.
// =============================================================================

interface ChipCommand {
  iconName: string
  label: string
  slashCommand: string
  description: string
  /** Action labels for the outline-chip buttons below the description.
   *  Empty array → no action row (card stays click-only). */
  actions: ReadonlyArray<string>
}

const SAMPLE_CHIP_COMMANDS: ReadonlyArray<ChipCommand> = [
  {
    iconName: 'clickup-logo-grey',
    label: 'ClickUp Roadmap',
    slashCommand: '/roadmap',
    description: 'Public product roadmap with upcoming features and releases',
    actions: ['Recent', 'Search', 'Find'],
  },
  {
    iconName: 'clickup-logo-grey',
    label: 'ClickUp Delivery',
    slashCommand: '/delivery',
    description: 'Bug fixes and enhancements currently in delivery',
    actions: ['Recent', 'Search', 'Find'],
  },
  {
    iconName: 'slack-logo-grey',
    label: 'OpenMSP Community',
    slashCommand: '/slack',
    description: 'Messages and discussions from the OpenMSP community Slack',
    actions: ['Recent', 'Search'],
  },
  {
    iconName: 'hubspot-logo-grey',
    label: 'Known Issues',
    slashCommand: '/known-issues',
    description: 'Customer-reported issues and similar past support tickets',
    actions: ['Recent', 'Search', 'Find'],
  },
  {
    iconName: 'hubspot-logo-grey',
    label: 'My Tickets',
    slashCommand: '/my-tickets',
    description: 'Your active support tickets and recent conversations',
    actions: ['Recent', 'Search', 'Display'],
  },
  {
    iconName: 'logo-openframe',
    label: 'OpenFrame Docs',
    slashCommand: '/docs',
    description: 'Full OpenFrame product documentation and reference',
    actions: ['Browse', 'Search'],
  },
  {
    iconName: 'newspaper',
    label: 'Blog Posts',
    slashCommand: '/blogs',
    description: 'Latest articles, guides, and announcements from the blog',
    actions: ['Recent', 'Search'],
  },
  {
    iconName: 'rocket-02',
    label: 'Product Releases',
    slashCommand: '/release-notes',
    description: 'OpenFrame version releases, changelogs, and update notes',
    actions: ['Recent', 'Search', 'Find'],
  },
  {
    iconName: 'rocket-02',
    label: 'Case Studies',
    slashCommand: '/case-studies',
    description: 'Customer success stories and real-world case studies',
    actions: ['Browse', 'Search'],
  },
  {
    iconName: 'rocket-02',
    label: 'Webinars',
    slashCommand: '/webinars',
    description: 'Upcoming live sessions and recorded webinar library',
    actions: ['Recent', 'Search'],
  },
  {
    iconName: 'rocket-02',
    label: 'Podcasts',
    slashCommand: '/podcasts',
    description: 'Latest episodes from OpenMSP and partner podcasts',
    actions: ['Recent', 'Search'],
  },
  {
    iconName: 'compass',
    label: 'Onboarding Guides',
    slashCommand: '/getting-started',
    description: 'Step-by-step guides to get started with OpenFrame',
    actions: ['Browse', 'Search'],
  },
  {
    iconName: 'compass',
    label: 'Events',
    slashCommand: '/events',
    description: 'Industry events, MSP meetups, and conferences',
    actions: ['Recent', 'Search'],
  },
]

export const ChipCommands: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Stack of `MingoOnboardingCard` rows fed from a sample `chipCommands` list — mirrors the empty-state body the EmbeddableChat renders (Figma node `7363:205938`). Icons are sourced from `icons-v2-generated` and tinted by the card via `ods-text-secondary`. Each card carries an `actions` row of outline-chip buttons (Recent / Search / Find / Browse / Display) — click any chip to log to the console.',
      },
    },
  },
  render: () => (
    <>
      {SAMPLE_CHIP_COMMANDS.map(
        ({ iconName, label, slashCommand, description, actions }) => {
          const Icon = resolveOnboardingIcon(iconName)
          return (
            <MingoOnboardingCard
              key={slashCommand + label}
              icon={<Icon size={16} />}
              title={label}
              slashCommand={slashCommand}
              description={description}
              actions={actions.map((actionLabel) => ({
                id: actionLabel.toLowerCase(),
                label: actionLabel,
                onClick: () => {
                  // eslint-disable-next-line no-console
                  console.log('[story] dispatch', slashCommand, actionLabel)
                },
              }))}
            />
          )
        },
      )}
    </>
  ),
}
