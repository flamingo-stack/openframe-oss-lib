/**
 * Shared fixtures for chat entity-card stories.
 *
 * Every chat entity-card under `src/components/chat/entity-cards/` is pure
 * presentation — it accepts a typed `item` (or `post` / `study` / `update` /
 * `guide` / `campaign`) and a resolved `href`. These fixtures supply realistic
 * mock data covering every docType in `CHAT_CARD_REGISTRY` so the designer can
 * page through the cards in Storybook without running the chat runtime.
 *
 * Server-only fields (status timestamps, AI processing flags, view counts,
 * platform joins, etc.) are populated with type-correct placeholders — none
 * of these cards read them at render time, but the wire types require them.
 */

import type { BlogPostSummary } from '../../types/blog'
import type { CaseStudy } from '../../types/case-study'
import type { CustomerInterview } from '../../types/customer-interview'
import type { GitHubActivityItem } from '../../components/chat/types/entities/github-activity'
import type { SlackMessageItem } from '../../components/chat/types/entities/slack-message'
import type { HubspotTicketItem } from '../../components/chat/types/entities/hubspot-ticket'
import type { DataRoomDocCardItem } from '../../components/chat/types/entities/data-room-doc'
import type { InvestorUpdate } from '../../components/chat/types/entities/investor-update'
import type { OnboardingGuide } from '../../components/chat/types/entities/onboarding-guide'
import type { RoadmapItem } from '../../components/chat/types/entities/roadmap-item'
import type {
  BaseProgramItem,
  ProgramHost,
} from '../../components/chat/types/entities/program-types'
import type {
  CampaignCardItem,
  GenericEntityCardItem,
} from '../../components/chat/entity-cards'

// =============================================================================
// Common
// =============================================================================

const NOW = Date.parse('2026-05-28T10:00:00Z')
const DAY = 24 * 60 * 60 * 1000

const isoDaysAgo = (days: number) => new Date(NOW - days * DAY).toISOString()

const SAMPLE_AUTHOR = {
  full_name: 'Pavlo Shylo',
  avatar_url:
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop',
  job_title: 'Frontend Engineer',
}

// =============================================================================
// GitHub Activity
// =============================================================================

export const githubCommitItem: GitHubActivityItem = {
  id: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
  title: 'fix(chat): hoist video player out of paragraph for assistant replies',
  repo: 'flamingo-cx/openframe',
  dateUpdated: isoDaysAgo(1),
  url: 'https://github.com/flamingo-cx/openframe/commit/a1b2c3d',
  kind: 'commit',
}

export const githubPullRequestItem: GitHubActivityItem = {
  id: '742',
  title: 'Embed Mingo chat in product hub admin shell',
  repo: 'flamingo-cx/openframe',
  dateUpdated: isoDaysAgo(2),
  url: 'https://github.com/flamingo-cx/openframe/pull/742',
  kind: 'pull_request',
}

export const githubPrReviewItem: GitHubActivityItem = {
  id: 'rev-9981',
  title: '[review:APPROVED] LGTM — nice cleanup of the dispatch registry',
  repo: 'flamingo-cx/openframe',
  dateUpdated: isoDaysAgo(2),
  url: 'https://github.com/flamingo-cx/openframe/pull/742#pullrequestreview-9981',
  kind: 'pr_review',
}

// =============================================================================
// Slack
// =============================================================================

export const slackMessageItem: SlackMessageItem = {
  id: 'p1716895200000300',
  title: 'kirill · #chat-architecture',
  preview:
    'Plan: roll out the Embeddable chat into Mingo as the primary surface, fall back to Guide-only on the marketing site.',
  channel: 'chat-architecture',
  dateUpdated: isoDaysAgo(1),
  url: 'https://flamingo-cx.slack.com/archives/C012ABC34/p1716895200000300',
}

// =============================================================================
// HubSpot Ticket
// =============================================================================

export const hubspotTicketItem: HubspotTicketItem = {
  id: '4429311208',
  title: 'Cannot connect Microsoft 365 tenant after Entra app rename',
  preview:
    'Customer reports the Entra app reauth fails with AADSTS50011 after they renamed their connector app yesterday morning.',
  status: 'IN_PROGRESS',
  statusLabel: 'Code review',
  priority: 'HIGH',
  customerCompany: 'Acme Managed Services',
  customerEmail: 'ops@acme-msp.com',
  dateUpdated: isoDaysAgo(0),
  url: 'https://app.hubspot.com/contacts/123456/ticket/4429311208',
}

// =============================================================================
// Data Room / Knowledge Base
// =============================================================================

export const dataRoomDocItem: DataRoomDocCardItem = {
  id: 'dr-doc-2024-q1-board-deck',
  title: 'Q1 2026 Board Deck — Final',
  path: 'investor-relations/board/2026-q1/q1-board-deck',
  preview:
    'ARR run-rate update, OpenMSP/OpenFrame split, hiring plan, runway scenarios.',
  url: '/data-room/investor-relations/board/2026-q1/q1-board-deck',
  sourceRepo: 'data-room-docs',
}

export const openframeDocsMarkdownItem: DataRoomDocCardItem = {
  id: 'kb-chat-architecture',
  title: 'Chat architecture: Guide vs Mingo modes',
  path: 'guides/chat/architecture',
  preview:
    'Three frontend surfaces share the lib chat. Guide mode uses an SSE adapter; Mingo mode uses NATS via the runtime.',
  url: '/knowledge-base/guides/chat/architecture',
  sourceRepo: 'openframe-docs',
}

// =============================================================================
// Generic Entity (financials)
// =============================================================================

export const financialKpiItem: GenericEntityCardItem = {
  id: 'kpi-arr-2026-q1',
  title: 'ARR — Annual Recurring Revenue',
  subtitle: 'Q1 2026 snapshot',
  preview: 'Composite metric across OpenMSP, OpenFrame and Flamingo platforms.',
  badge: { text: 'KPI', scheme: 'success' },
  facts: [
    { label: 'Current', value: '$4.82M' },
    { label: 'Previous', value: '$4.41M' },
    { label: 'QoQ', value: '+9.3%' },
  ],
  dateUpdated: isoDaysAgo(7),
  url: '/data-room/financials/kpi/arr-2026-q1',
}

export const capTableItem: GenericEntityCardItem = {
  id: 'cap-vertex-vii-safe',
  title: 'Vertex VII — $3.5M SAFE',
  subtitle: 'Seed round · executed',
  preview: 'Post-money valuation cap $35M, MFN clause active.',
  badge: { text: 'SAFE', scheme: 'cyan' },
  facts: [
    { label: 'Amount', value: '$3,500,000' },
    { label: 'Cap', value: '$35M' },
    { label: 'Discount', value: '—' },
  ],
  dateUpdated: isoDaysAgo(120),
  url: '/data-room/legal/fundraising/seed/executed/vertex-vii-3.5m-safe',
}

export const profitLossItem: GenericEntityCardItem = {
  id: 'pnl-2026-q1',
  title: 'Profit & Loss — Q1 2026',
  subtitle: 'Consolidated',
  preview: 'Revenue $1.21M, total opex $2.04M, net loss ($0.83M).',
  badge: { text: 'P&L', scheme: 'default' },
  facts: [
    { label: 'Revenue', value: '$1.21M' },
    { label: 'Opex', value: '$2.04M' },
    { label: 'Net', value: '-$0.83M' },
  ],
  dateUpdated: isoDaysAgo(30),
  url: '/data-room/financials/profit-loss/2026-q1',
}

export const balanceSheetItem: GenericEntityCardItem = {
  id: 'bs-2026-03',
  title: 'Balance Sheet — Mar 2026',
  subtitle: 'Month-end',
  preview: 'Assets $9.7M, liabilities $1.1M, equity $8.6M.',
  badge: { text: 'BS', scheme: 'default' },
  facts: [
    { label: 'Assets', value: '$9.7M' },
    { label: 'Liabilities', value: '$1.1M' },
    { label: 'Equity', value: '$8.6M' },
  ],
  dateUpdated: isoDaysAgo(60),
  url: '/data-room/financials/balance-sheet/2026-03',
}

export const cashFlowItem: GenericEntityCardItem = {
  id: 'cf-2026-q1',
  title: 'Cash Flow — Q1 2026',
  subtitle: 'Operating / Investing / Financing',
  preview: 'Operating cash burn $0.71M, investing $0.04M, financing $0.0M.',
  badge: { text: 'CF', scheme: 'warning' },
  facts: [
    { label: 'Operating', value: '-$0.71M' },
    { label: 'Investing', value: '-$0.04M' },
    { label: 'Financing', value: '$0.00M' },
  ],
  dateUpdated: isoDaysAgo(30),
  url: '/data-room/financials/cash-flow/2026-q1',
}

// =============================================================================
// Blog
// =============================================================================

export const blogPostSummary: BlogPostSummary = {
  id: 1042,
  title: 'How we built the Mingo chat: streaming, citations and inline cards',
  slug: 'how-we-built-mingo-chat',
  summary:
    'A deep-dive into the unified chat runtime that powers Guide and Mingo modes, including the SSE adapter, NATS sync and the entity-card dispatch.',
  featured_image:
    'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=675&fit=crop',
  published_at: isoDaysAgo(4),
  author_name: 'Pavlo Shylo',
  author_avatar:
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop',
  categories: [{ name: 'Engineering', slug: 'engineering' }],
  tags: [
    { name: 'chat', slug: 'chat' },
    { name: 'architecture', slug: 'architecture' },
  ],
  is_featured: true,
  view_count: 482,
}

// =============================================================================
// Case Study
// =============================================================================

export const caseStudy: CaseStudy = {
  id: 81,
  title: 'How Acme MSP cut response time by 62% with OpenFrame',
  slug: 'acme-msp-response-time',
  summary:
    'Acme consolidated four ticketing tools into OpenFrame and rebuilt their on-call rotation around the unified inbox.',
  featured_image:
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&h=675&fit=crop',
  user_id: 'user-acme-owner',
  challenge: 'Four ticketing tools, no shared SLA view, on-call burnout.',
  solution: 'Migrated to OpenFrame, wired NinjaOne + HubSpot into one inbox.',
  results: 'Mean response 32m → 12m. Tech satisfaction up two points.',
  testimonial_video_url: null,
  main_video_url: null,
  main_video_thumbnail: null,
  video_source_type: null,
  video_source: 'manual',
  video_bites: [],
  customer_interview_id: null,
  seo_title: null,
  seo_description: null,
  seo_keywords: null,
  og_image_url: null,
  status: 'published',
  published_at: isoDaysAgo(45),
  author_id: 'user-pavlo',
  created_at: isoDaysAgo(60),
  updated_at: isoDaysAgo(45),
  view_count: 920,
  // Relations (the card reads `user.full_name`, `user.avatar_url`, `msp.name`, `msp.icon_url`)
  user: {
    full_name: 'Jordan Reyes',
    avatar_url:
      'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=120&h=120&fit=crop',
    job_title: 'CEO, Acme MSP',
  } as unknown as CaseStudy['user'],
  msp: {
    id: 'msp-acme',
    name: 'Acme Managed Services',
    icon_url:
      'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=64&h=64&fit=crop',
    seat_count: 1200,
    created_at: isoDaysAgo(800),
    updated_at: isoDaysAgo(45),
  },
}

// =============================================================================
// Customer Interview
// =============================================================================

export const customerInterview: CustomerInterview = {
  id: 17,
  title: 'Interview with Jordan Reyes — life after consolidating ticketing',
  slug: 'jordan-reyes-acme-msp',
  video_summary:
    'Jordan walks through how Acme MSP migrated from four ticketing tools to OpenFrame in 11 weeks, and what the operational impact has been six months later.',
  transcript: null,
  user_id: 'user-acme-owner',
  main_video_url:
    'https://customer-bytes.flamingo.cx/interviews/jordan-reyes-acme.mp4',
  teasers: [],
  highlight_video_url: null,
  highlight_video_thumbnail: null,
  highlight_video_duration_ms: null,
  highlight_video_source: null,
  main_video_thumbnail:
    'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&h=675&fit=crop',
  case_study_id: 81,
  seo_title: null,
  seo_description: null,
  seo_keywords: null,
  og_image_url: null,
  featured_image:
    'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&h=675&fit=crop',
  status: 'completed',
  completed_at: isoDaysAgo(50),
  author_id: 'user-pavlo',
  custom_instructions: null,
  created_at: isoDaysAgo(60),
  updated_at: isoDaysAgo(50),
  view_count: 314,
  user: {
    full_name: 'Jordan Reyes',
    avatar_url:
      'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=120&h=120&fit=crop',
    job_title: 'CEO, Acme MSP',
  } as unknown as CustomerInterview['user'],
  msp: {
    id: 'msp-acme',
    name: 'Acme Managed Services',
    icon_url:
      'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=64&h=64&fit=crop',
    seat_count: 1200,
    created_at: isoDaysAgo(800),
    updated_at: isoDaysAgo(50),
  },
}

// =============================================================================
// Product Release — props are flat (no item type), see component signature
// =============================================================================

export const productReleaseSmProps = {
  title: 'OpenFrame 2.5 — Mingo chat goes GA',
  summary:
    'Embeddable chat with citations, inline cards and slash commands. Now generally available on every product hub surface.',
  version: '2.5.0',
  formattedDate: 'May 21, 2026',
  coverImage:
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop',
  hasVideoCover: false,
} as const

export const productReleaseLgProps = {
  ...productReleaseSmProps,
  releaseType: 'minor' as const,
  releaseStatus: 'stable' as const,
  releaseTypeBadgeColor: 'cyan' as const,
  viewCount: 1842,
  author: SAMPLE_AUTHOR,
  changelogCounts: {
    features: 7,
    fixes: 11,
    improvements: 5,
    breaking: 1,
  },
}

// =============================================================================
// Program (Podcast / Webinar / Event)
// =============================================================================

const sampleHosts: ProgramHost[] = [
  {
    id: 'host-kirill',
    name: 'Kirill',
    avatar_url:
      'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=120&h=120&fit=crop',
    role: 'Host',
  },
  {
    id: 'host-pavlo',
    name: 'Pavlo Shylo',
    avatar_url:
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop',
    role: 'Guest',
  },
]

export const podcastItem: BaseProgramItem = {
  id: 'pod-ep-042',
  title: 'Episode 42 — Building Embeddable AI chat for MSPs',
  description:
    'Kirill and Pavlo unpack how we wire SSE streaming, NATS sync and per-tenant slash commands into a single embeddable surface.',
  cover_url:
    'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600&h=600&fit=crop',
  date: isoDaysAgo(3),
  external_url: 'https://flamingo.cx/podcasts/ep-042',
  hosts: sampleHosts,
}

export const webinarItem: BaseProgramItem = {
  id: 'web-2026-06-msp-pricing',
  title: 'MSP pricing teardown — live from the Flamingo studio',
  description:
    'A live walkthrough of three MSP price books with red-pen annotation and Q&A.',
  cover_url:
    'https://images.unsplash.com/photo-1591115765373-5207764f72e4?w=600&h=600&fit=crop',
  date: isoDaysAgo(-5),
  external_url: 'https://flamingo.cx/webinars/msp-pricing-teardown',
  hosts: [sampleHosts[0]!],
}

export const eventItem: BaseProgramItem = {
  id: 'evt-2026-06-msp-conf-austin',
  title: 'MSP Founders Dinner — Austin',
  description:
    'Invite-only dinner for MSP founders, hosted by Flamingo and Acme Capital. Limited to 30 seats.',
  cover_url:
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=600&fit=crop',
  date: isoDaysAgo(-21),
  external_url: 'https://lu.ma/msp-austin-2026',
  hosts: sampleHosts,
}

// =============================================================================
// Investor Update
// =============================================================================

export const investorUpdate: InvestorUpdate = {
  id: 'iu-2026-q1',
  title: 'Investor update #12 — Q1 2026',
  slug: 'investor-update-12-2026-q1',
  update_number: 12,
  period_start: isoDaysAgo(150),
  period_end: isoDaysAgo(60),
  platform_id: 'platform-openmsp',
  content: null,
  video_summary: null,
  transcript: null,
  main_video_url: null,
  highlight_video_url: null,
  highlight_video_thumbnail: null,
  main_video_thumbnail: null,
  video_bites: [],
  featured_image:
    'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&h=675&fit=crop',
  strategic_update:
    'Q1 ARR grew 9.3% QoQ to $4.82M. We onboarded two design-partner MSPs (Acme and Cumulus) ahead of the public GA of Mingo chat.',
  financials: {},
  metrics_snapshot: {},
  content_refs: [],
  highlights: null,
  section_visibility: {},
  status: 'published',
  published_at: isoDaysAgo(60),
  author_id: 'user-pavlo',
  seo_title: null,
  seo_description: null,
  seo_keywords: null,
  og_image_url: null,
  hubspot_email_id: null,
  custom_instructions: null,
  created_at: isoDaysAgo(70),
  updated_at: isoDaysAgo(60),
  created_by: 'user-pavlo',
  updated_by: 'user-pavlo',
}

// =============================================================================
// Onboarding Guide
// =============================================================================

export const onboardingGuide: OnboardingGuide = {
  id: 'guide-getting-started-01',
  title: 'Install OpenFrame on your tenant',
  slug: 'install-openframe',
  section: 'Getting started',
  step_order: 1,
  section_order: 1,
  content:
    'Spin up the OpenFrame deployment on your Kubernetes cluster, point your DNS record at the load balancer, and bootstrap the admin user.',
  video_summary:
    'A 6-minute walkthrough of the helm install, DNS + cert wiring and the admin bootstrap flow.',
  transcript: null,
  transcript_words_data: null,
  srt_content: null,
  ai_transcript_formatted: null,
  main_video_url: null,
  main_video_thumbnail:
    'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=675&fit=crop',
  youtube_url: null,
  highlight_video_url: null,
  highlight_video_thumbnail: null,
  highlight_video_duration_ms: 360_000,
  highlight_video_source: null,
  video_bites: [],
  featured_image:
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=675&fit=crop',
  og_image_url: null,
  seo_title: null,
  seo_description: null,
  seo_keywords: null,
  status: 'published',
  published_at: isoDaysAgo(20),
  author_id: 'user-pavlo',
  author: {
    id: 'user-pavlo',
    full_name: SAMPLE_AUTHOR.full_name,
    avatar_url: SAMPLE_AUTHOR.avatar_url,
    job_title: SAMPLE_AUTHOR.job_title,
  },
  custom_instructions: null,
  config: null,
  ai_effort_score: null,
  created_at: isoDaysAgo(30),
  updated_at: isoDaysAgo(20),
  created_by: 'user-pavlo',
  updated_by: 'user-pavlo',
}

// =============================================================================
// Roadmap Item (drives 3 cardTypes via the `cardType` prop)
// =============================================================================

export const roadmapFeatureItem: RoadmapItem = {
  id: 'CU-7g4xyz',
  title: 'Per-tenant slash command registry',
  description:
    'Let admins author bespoke slash commands wired to their own RAG sources, with row-level permissions per slash command.',
  status: 'In Progress',
  statusColor: 'cyan',
  icon: null,
  figmaUrl: null,
  screenshots: [
    'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=720&fit=crop',
  ],
  targetVersion: 'v2.6',
  upvotes: 42,
  downvotes: 1,
  quarter: 'Q2 2026',
  clickupUrl: 'https://app.clickup.com/t/7g4xyz',
  customItemId: 1010, // Feature
}

export const roadmapDeliveryItem: RoadmapItem = {
  id: 'CU-8h5abc',
  title: 'Ship Mingo chat embed on the marketing site',
  description:
    'Bundle the EmbeddableChat into the marketing site shell with the Guide-only modes config and the public slash commands.',
  status: 'Done',
  statusColor: 'success',
  icon: null,
  figmaUrl: null,
  screenshots: [],
  targetVersion: 'v2.5',
  upvotes: 0,
  downvotes: 0,
  quarter: 'Q2 2026',
  clickupUrl: 'https://app.clickup.com/t/8h5abc',
  customItemId: 1010,
}

export const roadmapInternalTaskItem: RoadmapItem = {
  id: 'CU-9k6def',
  title: 'Migrate Guide → Mingo on the product hub',
  description:
    'Replace the legacy Guide widget on /admin and /support with the Mingo-modes EmbeddableChat, keeping Guide as the SSE adapter.',
  status: 'Review',
  statusColor: 'warning',
  icon: null,
  figmaUrl: null,
  screenshots: [],
  targetVersion: null,
  upvotes: 0,
  downvotes: 0,
  quarter: 'Q2 2026',
  clickupUrl: 'https://app.clickup.com/t/9k6def',
  customItemId: 1008, // Bug — but the cardType drives the visual class in the chat sm variant
}

// =============================================================================
// Marketing Campaign
// =============================================================================

export const campaignItem: CampaignCardItem = {
  id: 'camp-mingo-launch',
  name: 'Mingo chat — public launch',
  description:
    'Two-week launch campaign for the GA of Embeddable chat: blog series, podcast cross-promo, customer interview drop.',
  start_date: isoDaysAgo(-7),
  goals: [
    { id: 'g1', label: 'Drive 800 signups' },
    { id: 'g2', label: '12 podcast plays' },
  ],
}
