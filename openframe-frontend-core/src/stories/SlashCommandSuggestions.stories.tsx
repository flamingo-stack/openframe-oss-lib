import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { SlashCommandSuggestions } from '../components/chat/slash-command-suggestions'
import type {
  SlashCommandActionId,
  SlashCommandSummary,
} from '../components/chat/types'

const meta: Meta<typeof SlashCommandSuggestions> = {
  title: 'Chat/SlashCommandSuggestions',
  component: SlashCommandSuggestions,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Slash-command autocomplete dropdown — opens above the chat input when the user types `/`. Each row is a `MingoOnboardingCard` so the dropdown and the empty-state list share one card design. Icons resolve through the shared `resolveOnboardingIcon` registry; the production `/api/docs/commands` short keys (`clickup`, `github`, `slack`, `openframe`, `rocket`, `briefcase`, `graduation-cap`, `video`, `headphones`, `calendar`, …) are wired up alongside the legacy Figma-style aliases.',
      },
    },
  },
  argTypes: {
    onHover: { control: false },
    onSelect: { control: false },
    onAction: { control: false },
    resolveSourceIcon: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-[640px] bg-ods-bg p-6 rounded-md border border-ods-border">
        {/* Mock input row so the dropdown's `absolute bottom-full`
            positioning has something to anchor against, exactly like
            inside ChatInput. */}
        <div className="relative">
          <Story />
          <div className="h-12 rounded-md border border-ods-border bg-ods-card flex items-center px-4 text-ods-text-muted text-sm">
            /
          </div>
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

// =============================================================================
// Sample commands — keys match the live `/api/docs/commands` contract
// in multi-platform-hub. `iconName` resolves via the onboarding registry.
// =============================================================================

const SAMPLE_COMMANDS: SlashCommandSummary[] = [
  {
    id: 'roadmap',
    label: 'ClickUp Roadmap',
    description:
      'Browse the public ClickUp roadmap -- bare for the upcoming list, with task id or name to drill into one',
    iconName: 'clickup',
    primarySourceId: 'clickup-roadmap',
    argumentHint: '[task id or name]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 10,
  },
  {
    id: 'delivery',
    label: 'ClickUp Delivery',
    description:
      'Browse the ClickUp delivery list (bug fixes + enhancements) -- bare for recent, with task id or name to drill into one',
    iconName: 'clickup',
    primarySourceId: 'clickup-delivery',
    argumentHint: '[task id or name]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 11,
  },
  {
    id: 'commits',
    label: 'OpenFrame Commits',
    description:
      'Browse default-branch commits -- bare for the latest list, with sha or headline to drill into one',
    iconName: 'github',
    primarySourceId: 'github-commits-public',
    argumentHint: '[sha or headline]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 16,
  },
  {
    id: 'pull-requests',
    label: 'OpenFrame Pull Requests',
    description:
      'Browse pull requests -- bare for the latest list, with title or external id to drill into one',
    iconName: 'github',
    primarySourceId: 'github-pull-requests-public',
    argumentHint: '[title or external id]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 17,
  },
  {
    id: 'pr-reviews',
    label: 'OpenFrame PR Reviews',
    description:
      'Browse pull-request reviews -- bare for the latest list, with reviewer or topic to drill into one',
    iconName: 'github',
    primarySourceId: 'github-pr-reviews-public',
    argumentHint: '[reviewer or topic]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 18,
  },
  {
    id: 'slack',
    label: 'OpenMSP Community',
    description:
      'Browse OpenMSP community Slack messages -- bare for recent, with message id to drill into one',
    iconName: 'slack',
    primarySourceId: 'slack-messages',
    argumentHint: '[message id or topic]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 19,
  },
  {
    id: 'docs',
    label: 'OpenFrame Docs',
    description:
      'Browse OpenFrame documentation -- bare for an index, with path or name to drill into one',
    iconName: 'openframe',
    primarySourceId: 'openframe-docs',
    argumentHint: '[path or topic]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 30,
  },
  {
    id: 'blogs',
    label: 'Blog Posts',
    description:
      'Browse blog posts -- bare for the latest list, with title or slug to drill into one',
    iconName: 'newspaper',
    primarySourceId: 'blog-posts',
    argumentHint: '[title or slug]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 50,
  },
  {
    id: 'releases',
    label: 'Product Releases',
    description:
      'Browse product releases -- bare for the latest list, with title, slug, or version to drill into one',
    iconName: 'rocket',
    primarySourceId: 'product-releases',
    argumentHint: '[title, slug, or version]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 51,
  },
  {
    id: 'case-studies',
    label: 'Case Studies',
    description:
      'Browse customer case studies -- bare for the list, with title or slug to drill into one',
    iconName: 'briefcase',
    primarySourceId: 'case-studies',
    argumentHint: '[customer or title]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 52,
  },
  {
    id: 'getting-started',
    label: 'Onboarding Guides',
    description:
      'Browse onboarding guides -- bare for an indexed list, with title, slug, section, or Step N to drill into one',
    iconName: 'graduation-cap',
    primarySourceId: 'onboarding-guides',
    argumentHint: "[title, slug, section, or 'Step N']",
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 53,
  },
  {
    id: 'webinars',
    label: 'Webinars',
    description:
      'Browse webinars -- bare for the upcoming/recent list, with title or id to drill into one',
    iconName: 'video',
    primarySourceId: 'webinars',
    argumentHint: '[title or id]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 54,
  },
  {
    id: 'events',
    label: 'Events',
    description:
      'Browse industry events, meetups, and conferences -- bare for the list, with name or id to drill into one',
    iconName: 'calendar',
    primarySourceId: 'events',
    argumentHint: '[name or id]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 55,
  },
  {
    id: 'podcasts',
    label: 'Podcasts',
    description:
      'Browse podcast episodes -- bare for the latest list, with title or id to drill into one',
    iconName: 'headphones',
    primarySourceId: 'podcasts',
    argumentHint: '[title or id]',
    actions: [
      { id: 'browse', label: 'Recent' },
      { id: 'search', label: 'Search' },
      { id: 'find', label: 'Find' },
    ],
    displayOrder: 56,
  },
]

// =============================================================================
// Stories
// =============================================================================

/** Static — first row highlighted, full command set visible. */
export const Default: Story = {
  args: {
    commands: SAMPLE_COMMANDS,
    highlightedIdx: 0,
    onHover: () => {},
    onSelect: (cmd) => {
      // eslint-disable-next-line no-console
      console.log('[story] select', cmd.id)
    },
    onAction: (cmd, actionId: SlashCommandActionId) => {
      // eslint-disable-next-line no-console
      console.log('[story] action', cmd.id, actionId)
    },
  },
}

/** Interactive — hovered/clicked rows update local state so you can
 *  drive the keyboard-style highlight by hovering. */
export const Interactive: Story = {
  render: (args) => {
    const [idx, setIdx] = useState(0)
    return (
      <SlashCommandSuggestions
        {...args}
        commands={SAMPLE_COMMANDS}
        highlightedIdx={idx}
        onHover={setIdx}
        onSelect={(cmd) => {
          // eslint-disable-next-line no-console
          console.log('[story] select', cmd.id)
        }}
        onAction={(cmd, actionId) => {
          // eslint-disable-next-line no-console
          console.log('[story] action', cmd.id, actionId)
        }}
      />
    )
  },
  args: {},
}

/** Single match — narrow result set, mimics typing `/road` to filter. */
export const FilteredSingle: Story = {
  args: {
    commands: SAMPLE_COMMANDS.slice(0, 1),
    highlightedIdx: 0,
    onHover: () => {},
    onSelect: () => {},
    onAction: () => {},
  },
}

/** No actions — `onAction` undefined; the row's chip rail collapses
 *  and the row is click-only (default-select behavior). */
export const NoActions: Story = {
  args: {
    commands: SAMPLE_COMMANDS,
    highlightedIdx: 2,
    onHover: () => {},
    onSelect: () => {},
    onAction: undefined,
  },
}
