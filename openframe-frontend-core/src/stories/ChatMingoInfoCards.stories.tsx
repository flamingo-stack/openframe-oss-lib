import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { ReactNode } from 'react'
import { MingoInfoCard } from '../components/chat/mingo-info-card'
import { ChatColumnDecorator, makeAnchorProps } from './__fixtures__/chat-card-decorator'
import { MingoIcon } from '../components/icons'
import { EyeIcon } from '../components/icons-v2-generated/interface/eye-icon'
import { ArrowRightUpIcon } from '../components/icons-v2-generated/arrows/arrow-right-up-icon'
import { TagIcon } from '../components/icons-v2-generated/shopping/tag-icon'
import { CodingCommitIcon } from '../components/icons-v2-generated/coding/coding-commit-icon'
import { CodingPullRequestIcon } from '../components/icons-v2-generated/coding/coding-pull-request-icon'
import { CodeIcon } from '../components/icons-v2-generated/coding/code-icon'
import { SlackLogoGreyIcon } from '../components/icons-v2-generated/brand-logos/slack-logo-grey-icon'
import { FileContentIcon } from '../components/icons-v2-generated/documents/file-content-icon'
import { ChartBar01VerIcon } from '../components/icons-v2-generated/charts/chart-bar-01-ver-icon'
import { ChartPieIcon } from '../components/icons-v2-generated/charts/chart-pie-icon'
import { MoneyBillDollarIcon } from '../components/icons-v2-generated/finance/money-bill-dollar-icon'
import { BankIcon } from '../components/icons-v2-generated/finance/bank-icon'
import { CoinsExchangeCurrencyIcon } from '../components/icons-v2-generated/finance/coins-exchange-currency-icon'
import { NewspaperIcon } from '../components/icons-v2-generated/documents/newspaper-icon'
import { TrophyIcon } from '../components/icons-v2-generated/sport/trophy-icon'
import { MicrophoneIcon } from '../components/icons-v2-generated/household/microphone-icon'
import { Rocket02Icon } from '../components/icons-v2-generated/vehicles-and-delivery/rocket-02-icon'
import { TruckFastIcon } from '../components/icons-v2-generated/vehicles-and-delivery/truck-fast-icon'
import { PresentationBarIcon } from '../components/icons-v2-generated/charts/presentation-bar-icon'
import { PresentationLineIcon } from '../components/icons-v2-generated/charts/presentation-line-icon'
import { CalendarIcon } from '../components/icons-v2-generated/date-and-time/calendar-icon'
import { CompassIcon } from '../components/icons-v2-generated/map-and-travel/compass-icon'
import { MapIcon } from '../components/icons-v2-generated/map-and-travel/map-icon'
import { CheckSquareIcon } from '../components/icons-v2-generated/signs-and-symbols/check-square-icon'
import { Megaphone01Icon } from '../components/icons-v2-generated/shopping/megaphone-01-icon'

/**
 * Chat entity-cards re-skinned with `MingoInfoCard`.
 *
 * As each `[card://type:id]` registry entry in `entity-cards/dispatch.tsx` is
 * migrated to render a `MingoInfoCard`, its variants are mirrored here so the
 * compact in-chat appearance can be reviewed in isolation — same column width
 * and background the dispatch renders into, without booting the chat runtime.
 *
 * Each `render` reproduces the registry's field mapping for that card type
 * (icon, status pill, description, "⋯" menu). Anchor clicks are neutralized via
 * `makeAnchorProps` so the Storybook iframe doesn't navigate away.
 */
const meta: Meta<typeof MingoInfoCard> = {
  title: 'Chat/ChatMingoInfoCards',
  component: MingoInfoCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'In-chat entity cards rendered through `MingoInfoCard`. One section per migrated `CHAT_CARD_REGISTRY` type — mirrors the icon / status / description / menu mapping from `entity-cards/dispatch.tsx`.',
      },
    },
  },
  decorators: [
    (Story) => (
      <ChatColumnDecorator>
        <Story />
      </ChatColumnDecorator>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

/** Shared "⋯" overflow menu (Figma `7740:55075`): "Ask Mingo" (Mingo logo)
 *  followed by "Open Details" (eye) with a trailing ↗ open-in-new-tab side
 *  button. */
const openMenu = (
  href: string,
  openDetails?: { label: string; icon: ReactNode },
) => [
  {
    items: [
      {
        id: 'discuss',
        label: 'Ask Mingo',
        icon: (
          <MingoIcon
            className="size-5"
            color="white"
            eyesColor="var(--ods-flamingo-cyan-base)"
            cornerColor="var(--ods-flamingo-cyan-base)"
          />
        ),
        onClick: () => {
          // eslint-disable-next-line no-console
          console.log('[story] ask mingo', href)
        },
      },
      {
        id: 'open-details',
        label: openDetails?.label ?? 'Open Details',
        icon: openDetails?.icon ?? <EyeIcon size={20} />,
        onClick: () => {
          // eslint-disable-next-line no-console
          console.log('[story] open details', href)
        },
        iconAction: {
          icon: <ArrowRightUpIcon size={20} />,
          'aria-label': 'Open in new tab',
          onClick: () => {
            // eslint-disable-next-line no-console
            console.log('[story] open in new tab', href)
          },
        },
      },
    ],
  },
]

// =============================================================================
// HubSpot ticket — icon: HubSpot grey logo · status: ticket state · desc: preview
// =============================================================================

export const HubspotTicket: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Registry types `hubspot_ticket` / `_anon` / `_self`. Status pill maps the ticket state (Closed → green, Open → amber, other → grey); description is the ticket preview.',
      },
    },
  },
  render: () => {
    const HREF = 'https://app.hubspot.com/contacts/0/ticket/123'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="Login page returns 500 after SSO redirect"
          description="Customer cannot sign in via Google SSO since this morning…"
          icon={<TagIcon size={24} />}
          status={{ label: 'Open', variant: 'warning' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF, {
            label: 'Open Ticket Details',
            icon: <TagIcon size={20} />,
          })}
          menuAriaLabel="Ticket actions"
        />
        <MingoInfoCard
          title="Export to CSV missing last column"
          description="Resolved — shipped in 2.14.1, customer confirmed the fix."
          icon={<TagIcon size={24} />}
          status={{ label: 'Closed', variant: 'success' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF, {
            label: 'Open Ticket Details',
            icon: <TagIcon size={20} />,
          })}
          menuAriaLabel="Ticket actions"
        />
        <MingoInfoCard
          title="Waiting on customer logs for the sync failure"
          description="Pending — asked for the agent log bundle from the affected host."
          icon={<TagIcon size={24} />}
          status={{ label: 'Waiting on us', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF, {
            label: 'Open Ticket Details',
            icon: <TagIcon size={20} />,
          })}
          menuAriaLabel="Ticket actions"
        />
        <MingoInfoCard
          title="Ticket with no preview text and no status set at all"
          icon={<TagIcon size={24} />}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF, {
            label: 'Open Ticket Details',
            icon: <TagIcon size={20} />,
          })}
          menuAriaLabel="Ticket actions"
        />
      </div>
    )
  },
}

// =============================================================================
// GitHub activity — icon per kind · status: review state or activity type ·
// description: "<id> · <date>"
// =============================================================================

export const GithubActivity: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Registry types `github_commit` / `github_pull_request` / `github_pr_review` (+ `_public`). Icon differs per kind (commit / pull-request / code); the pill shows the PR review state (Approved → green, Changes → red, Comment → grey) or, for commits/PRs, the neutral activity type.',
      },
    },
  },
  render: () => {
    const HREF = 'https://github.com/flamingo/openframe/commit/a1b2c3d'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="fix(auth): guard SSO redirect against null session"
          description="a1b2c3d · May 28, 2026"
          icon={<CodingCommitIcon size={24} />}
          status={{ label: 'Commit', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Activity actions"
        />
        <MingoInfoCard
          title="Add device bulk-actions to the fleet table"
          description="#482 · May 27, 2026"
          icon={<CodingPullRequestIcon size={24} />}
          status={{ label: 'PR', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Activity actions"
        />
        <MingoInfoCard
          title="Pavlo Shylo"
          description="#482 · May 27, 2026"
          icon={<CodeIcon size={24} />}
          status={{ label: 'Approved', variant: 'success' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Activity actions"
        />
        <MingoInfoCard
          title="Alex Rivera"
          description="#479 · May 26, 2026"
          icon={<CodeIcon size={24} />}
          status={{ label: 'Changes', variant: 'error' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Activity actions"
        />
        <MingoInfoCard
          title="Sam Lee"
          description="#477 · May 25, 2026"
          icon={<CodeIcon size={24} />}
          status={{ label: 'Comment', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Activity actions"
        />
      </div>
    )
  },
}

// =============================================================================
// Slack message — icon: Slack grey logo · no pill · description: message text
// =============================================================================

export const SlackMessage: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Registry type `slack_message`. No status pill (Slack has no status); the channel is appended to the author title ("Author · #channel"), and the description is the message preview text.',
      },
    },
  },
  render: () => {
    const HREF = 'https://flamingo.slack.com/archives/C12345/p1700000000'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="Pavlo Shylo · #deploys"
          description="Heads up — the staging deploy is going out in 10 minutes, hold any merges to main."
          icon={<SlackLogoGreyIcon size={24} />}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Message actions"
        />
        <MingoInfoCard
          title="Alex Rivera · #incidents"
          description="Found the root cause of the sync failure — it's the token refresh race. PR incoming."
          icon={<SlackLogoGreyIcon size={24} />}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Message actions"
        />
        <MingoInfoCard
          title="Sam Lee · #general"
          icon={<SlackLogoGreyIcon size={24} />}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Message actions"
        />
      </div>
    )
  },
}

// =============================================================================
// Data-room doc / markdown — icon: FileContent · status: source badge ·
// description: preview
// =============================================================================

export const DataRoomDoc: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Registry types `data_room_doc` / `markdown`. Status pill is the provenance label (the source-repo label, or a neutral "Document" when unknown); the description is the content preview.',
      },
    },
  },
  render: () => {
    const HREF = 'https://hub.flamingo.cx/docs/openframe/getting-started'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="Getting started with OpenFrame"
          description="Install the agent, connect your first device, and open the fleet view."
          icon={<FileContentIcon size={24} />}
          status={{ label: 'OpenFrame Docs', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Document actions"
        />
        <MingoInfoCard
          title="Series A — financial model (Q1 2026)"
          description="Revenue, burn, and runway projections for the upcoming raise."
          icon={<FileContentIcon size={24} />}
          status={{ label: 'Data room', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Document actions"
        />
        <MingoInfoCard
          title="Unlabeled doc — source repo unknown, falls back to Document"
          description="Neutral provenance so unknown content can't be mislabeled."
          icon={<FileContentIcon size={24} />}
          status={{ label: 'Document', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Document actions"
        />
      </div>
    )
  },
}

// =============================================================================
// Financial — distinct icon per type · no pill · description: subtitle
// =============================================================================

export const Financial: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Registry types `financial_kpi` / `cap_table` / `profit_loss` / `balance_sheet` / `cash_flow`. No status pill — the per-type icon carries the type signal (chart / pie / money / bank / exchange); the description is the subtitle.',
      },
    },
  },
  render: () => {
    const HREF = 'https://hub.flamingo.cx/data-room/financials'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="Net revenue retention"
          description="TTM · 118%"
          icon={<ChartBar01VerIcon size={24} />}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Document actions"
        />
        <MingoInfoCard
          title="Cap table — Series A"
          description="Post-money · $42M"
          icon={<ChartPieIcon size={24} />}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Document actions"
        />
        <MingoInfoCard
          title="Profit & loss"
          description="Q1 2026"
          icon={<MoneyBillDollarIcon size={24} />}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Document actions"
        />
        <MingoInfoCard
          title="Balance sheet"
          description="As of Mar 31, 2026"
          icon={<BankIcon size={24} />}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Document actions"
        />
        <MingoInfoCard
          title="Cash flow statement"
          description="Q1 2026 · burn $1.1M/mo"
          icon={<CoinsExchangeCurrencyIcon size={24} />}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Document actions"
        />
      </div>
    )
  },
}

// =============================================================================
// Blog post — media: cover image (newspaper-icon fallback) · pill: category ·
// description: summary
// =============================================================================

export const BlogPost: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Registry type `blog_post` (fetch mode). Media is the cover `featured_image` (OG placeholder, then a newspaper glyph as fallbacks); the pill is the first category; the description is the post summary.',
      },
    },
  },
  render: () => {
    const HREF = 'https://openmsp.com/blog/rmm-buyers-guide'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="The 2026 RMM buyer's guide"
          description="What to look for when choosing a remote monitoring and management platform."
          imageSrc="https://picsum.photos/seed/rmm/80"
          imageAlt="The 2026 RMM buyer's guide"
          icon={<NewspaperIcon size={24} />}
          status={{ label: 'Guides', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Article actions"
        />
        <MingoInfoCard
          title="Post with no cover image — falls back to the newspaper icon"
          description="When featured_image and the OG placeholder are both missing."
          icon={<NewspaperIcon size={24} />}
          status={{ label: 'News', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Article actions"
        />
        <MingoInfoCard
          title="How we built the Mingo chat: streaming, citations and inline cards"
          description="A deep-dive into the unified chat runtime that powers Guide and Mingo modes…"
          imageSrc="https://picsum.photos/seed/videopost/80"
          imageAlt="How we built the Mingo chat"
          icon={<NewspaperIcon size={24} />}
          status={{ label: 'Video', variant: 'primary' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Article actions"
        />
      </div>
    )
  },
}

// =============================================================================
// Case study — trophy fallback icon · "Case study" pill · cover image
// =============================================================================

export const CaseStudy: Story = {
  render: () => {
    const HREF = 'https://openmsp.com/case-studies/acme-it'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="How Acme IT cut ticket volume by 40%"
          description="Acme IT · Jordan Blake"
          imageSrc="https://picsum.photos/seed/acme/80"
          imageAlt="How Acme IT cut ticket volume by 40%"
          icon={<TrophyIcon size={24} />}
          status={{ label: 'Case study', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Case study actions"
        />
        <MingoInfoCard
          title="Case study without a cover — trophy icon fallback"
          description="NorthStar MSP"
          icon={<TrophyIcon size={24} />}
          status={{ label: 'Case study', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Case study actions"
        />
      </div>
    )
  },
}

// =============================================================================
// Customer interview — microphone fallback · "Interview" pill
// =============================================================================

export const CustomerInterview: Story = {
  render: () => {
    const HREF = 'https://openmsp.com/interviews/jamie-fox'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="Scaling an MSP from 5 to 50 technicians"
          description="Jamie Fox · BrightLayer"
          imageSrc="https://picsum.photos/seed/interview/80"
          imageAlt="Scaling an MSP from 5 to 50 technicians"
          icon={<MicrophoneIcon size={24} />}
          status={{ label: 'Interview', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Interview actions"
        />
      </div>
    )
  },
}

// =============================================================================
// Product release — rocket fallback · version pill · description: summary/date
// =============================================================================

export const ProductRelease: Story = {
  render: () => {
    const HREF = 'https://openframe.org/releases/2-14-0'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="OpenFrame 2.14"
          description="Bulk device actions, faster fleet table, SSO hardening."
          imageSrc="https://picsum.photos/seed/release/80"
          imageAlt="OpenFrame 2.14"
          icon={<Rocket02Icon size={24} />}
          status={{ label: 'v2.14', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Release actions"
        />
        <MingoInfoCard
          title="OpenFrame 2.13.2 — patch release"
          description="May 12, 2026"
          icon={<Rocket02Icon size={24} />}
          status={{ label: 'v2.13.2', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Release actions"
        />
      </div>
    )
  },
}

// =============================================================================
// Programs — podcast / webinar / event, distinct icon + type pill
// =============================================================================

export const Programs: Story = {
  render: () => {
    const HREF = 'https://openmsp.com/podcasts/ep-42'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="Ep. 42 — The economics of co-managed IT"
          description="May 28, 2026 · 42 min"
          imageSrc="https://picsum.photos/seed/podcast/80"
          imageAlt="Ep. 42 — The economics of co-managed IT"
          icon={<MicrophoneIcon size={24} />}
          status={{ label: 'Podcast', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Podcast actions"
        />
        <MingoInfoCard
          title="Live: securing the MSP supply chain"
          description="Jun 4, 2026 · 11:00 AM PT · 1h"
          icon={<PresentationBarIcon size={24} />}
          status={{ label: 'Webinar', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Webinar actions"
        />
        <MingoInfoCard
          title="OpenMSP meetup — Austin"
          description="Jun 18, 2026 · Austin, TX"
          icon={<CalendarIcon size={24} />}
          status={{ label: 'Event', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Event actions"
        />
      </div>
    )
  },
}

// =============================================================================
// Investor update — presentation fallback · "Investor update" pill
// =============================================================================

export const InvestorUpdate: Story = {
  render: () => {
    const HREF = 'https://hub.flamingo.cx/investor-updates/2026-q1'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="Q1 2026 investor update"
          description="118% NRR, $42M post-money, 14 months runway."
          imageSrc="https://picsum.photos/seed/investor/80"
          imageAlt="Q1 2026 investor update"
          icon={<PresentationLineIcon size={24} />}
          status={{ label: 'Investor update', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Update actions"
        />
        <MingoInfoCard
          title="Update #7"
          description="Title-less row falls back to the update number."
          icon={<PresentationLineIcon size={24} />}
          status={{ label: 'Investor update', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Update actions"
        />
      </div>
    )
  },
}

// =============================================================================
// Onboarding guide — compass fallback · "Guide" pill
// =============================================================================

export const OnboardingGuide: Story = {
  render: () => {
    const HREF = 'https://hub.flamingo.cx/guides/first-device'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="Connect your first device"
          description="A five-minute walkthrough from install to live telemetry."
          imageSrc="https://picsum.photos/seed/guide/80"
          imageAlt="Connect your first device"
          icon={<CompassIcon size={24} />}
          status={{ label: 'Guide', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Guide actions"
        />
      </div>
    )
  },
}

// =============================================================================
// Roadmap / delivery / task — per-type icon · coloured status pill · no image
// =============================================================================

export const Roadmap: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Registry types `roadmap_item` / `delivery_item` / `internal_task`. Icon priority mirrors RoadmapCard: server integration logo (`item.icon`, shown contained) → task-type glyph → per-type default (map / truck / check-square). The status pill is coloured via the shared `getStatusColorScheme` mapping (done → green, in-progress → amber, blocked → red, other → grey).',
      },
    },
  },
  render: () => {
    const HREF = 'https://hub.flamingo.cx/roadmap/RM-128'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="Per-tenant audit log export"
          description="Server integration logo (e.g. ClickUp) shown contained in the box."
          icon={
            <img
              src="https://picsum.photos/seed/clickuplogo/48"
              alt=""
              className="size-6 object-contain"
            />
          }
          status={{ label: 'In Progress', variant: 'warning' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Roadmap actions"
        />
        <MingoInfoCard
          title="Roadmap item with no logo — per-type default glyph"
          description="Falls back to the map glyph when there's no server icon."
          icon={<MapIcon size={24} />}
          status={{ label: 'Planned', variant: 'grey' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Roadmap actions"
        />
        <MingoInfoCard
          title="Ship bulk device tagging"
          description="Tag and filter devices in bulk from the fleet table."
          icon={<TruckFastIcon size={24} />}
          status={{ label: 'Done', variant: 'success' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Roadmap actions"
        />
        <MingoInfoCard
          title="Investigate flaky NATS reconnect"
          description="Reconnect storm under network partition — needs a repro."
          icon={<CheckSquareIcon size={24} />}
          status={{ label: 'Blocked', variant: 'error' }}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Roadmap actions"
        />
      </div>
    )
  },
}

// =============================================================================
// Marketing campaign — megaphone icon · coloured status pill
// =============================================================================

export const MarketingCampaign: Story = {
  render: () => {
    const HREF = 'https://hub.flamingo.cx/admin/campaigns/c-91'
    return (
      <div className="flex flex-col gap-3">
        <MingoInfoCard
          title="Spring RMM migration push"
          description="Apr 1, 2026 · 3 goals · Marketing campaign"
          icon={<Megaphone01Icon size={24} />}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Campaign actions"
        />
        <MingoInfoCard
          title="Webinar promo — supply chain security"
          description="May 20, 2026 · 1 goal · Marketing campaign"
          icon={<Megaphone01Icon size={24} />}
          anchorProps={makeAnchorProps(HREF)}
          menuGroups={openMenu(HREF)}
          menuAriaLabel="Campaign actions"
        />
      </div>
    )
  },
}
