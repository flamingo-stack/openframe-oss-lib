'use client';

/**
 * Per-type card registry for the related-content rail — the SIZED sibling of
 * the chat side's `CHAT_CARD_REGISTRY` (`../chat/entity-cards/dispatch.tsx`),
 * and built to the same shape: ONE entry per content type, carrying that
 * type's skeleton and its card renderer, dispatched once from
 * `related-content-section.tsx`.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The rail fetches one row per ref from that type's public list API. The row
 * arrives as `unknown` (`useSelfFetch<unknown>` → `extractItems`), and its
 * SHAPE is decided at runtime by the ref's `type`. The rail used to bridge
 * that with a single `item: any` threaded through a ten-branch switch, so
 * every `prop={item}` forward was an unchecked promise: a row missing a field
 * reached a card that declared it required, and the card rendered the miss
 * (an empty heading, a version pill reading "vundefined").
 *
 * Each entry here closes over its OWN row type instead. `cardEntry<Row>` pairs
 * a `decode` (runtime `unknown` → `Row`) with a `render` that receives `Row`,
 * and erases `Row` from the stored entry — so the registry is homogeneous
 * (`Record<string, RelatedCardRegistryEntry>`) while every branch stays
 * concretely typed. No `any`, no assertions into card row types.
 *
 * ON THE `*_ROW_DEFAULTS` CONSTANTS
 * ---------------------------------
 * Each card declares the FULL entity type as its row prop (`BlogPostSummary`,
 * `CaseStudy`, …) while reading only a handful of fields off it, and the list
 * APIs return projections rather than whole rows. A decoder therefore reads
 * the card's read set from the row and takes every other required field from
 * a `*_ROW_DEFAULTS` literal. Those placeholders are inert BY CONSTRUCTION —
 * the decoded row goes nowhere but its own card, and the card never reads
 * them. They are annotated with the entity type on purpose: a new required
 * field on `CaseStudy` surfaces as a compile error here instead of silently
 * reaching a card as `undefined`, which is the exact failure this file
 * replaces.
 *
 * ADDING A TYPE: one entry below (skeleton + decode + render), plus the chat
 * side's `CHAT_CARD_REGISTRY` and the list-URL builder — see the LOCKSTEP note
 * in `related-content-section.tsx`.
 */

import type React from 'react';
import type { BlogPostSummary } from '../../types/blog';
import type { CaseStudy } from '../../types/case-study';
import type { CustomerInterview } from '../../types/customer-interview';
import type { EntityAuthor } from '../../types/entity-author';
import type { MSP } from '../../types/stack';
import type { UserProfile } from '../../types/user';
// DEEP card imports — NOT the `../chat` barrel. See the import note in
// `related-content-section.tsx`: the barrel statically reaches
// @tanstack/react-query, deep paths keep this module's source graph free of it.
import { BlogCard, BlogCardSkeleton } from '../chat/entity-cards/blog-card';
import { CaseStudyCard, CaseStudyCardSkeleton } from '../chat/entity-cards/case-study-card';
import { CustomerInterviewCard, CustomerInterviewCardSkeleton } from '../chat/entity-cards/customer-interview-card';
// Type-only — erased at build, no runtime dependency on the dispatch module.
import type { ChatCardDispatchExtras } from '../chat/entity-cards/dispatch';
import { HowIWorkCard, HowIWorkCardSkeleton, type HowIWorkCardData } from '../chat/entity-cards/how-i-work-card';
import { InvestorUpdateCard, InvestorUpdateCardSkeleton } from '../chat/entity-cards/investor-update-card';
import { OnboardingGuideCard, OnboardingGuideCardSkeleton } from '../chat/entity-cards/onboarding-guide-card';
import { ProductReleaseCard, ProductReleaseCardSkeleton } from '../chat/entity-cards/product-release-card';
import { buildProductReleaseCardProps } from '../chat/entity-cards/product-release-card-defaults';
import { ProgramCard, ProgramCardSkeleton } from '../chat/entity-cards/program-card';
import { RoadmapCard, RoadmapCardSkeleton } from '../chat/entity-cards/roadmap-card';
import {
  WhatIShippedCard,
  WhatIShippedCardSkeleton,
  type WhatIShippedCardData,
} from '../chat/entity-cards/what-i-shipped-card';
import type { InvestorUpdate } from '../chat/types/entities/investor-update';
import type { OnboardingGuide } from '../chat/types/entities/onboarding-guide';
import type { BaseProgramItem, ProgramHost } from '../chat/types/entities/program-types';
import type { RoadmapItem } from '../chat/types/entities/roadmap-item';

export type CardSize = 'lg' | 'default' | 'sm';

/** Anchor prop bundle the per-card link surface receives — same shape the
 *  hub's `useNavLink` returns and the chat dispatcher's anchor builders
 *  produce. `null` = non-anchor mode (no URL). */
export interface CardLinkAnchorProps {
  href: string;
  target?: '_blank';
  rel?: 'noopener noreferrer';
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

// =============================================================================
// Row reading — the ONE place a runtime row is inspected.
// =============================================================================

/**
 * View an unvalidated row as a keyed bag. This claims nothing about the row's
 * SHAPE — every read below still checks the value's type — it only says "this
 * is an object I may look keys up on". A non-object row (null, a string, a
 * number) collapses to `{}`, so every decoder degrades to its defaults instead
 * of throwing.
 */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** A STRING field, or `undefined` when missing or wrong-typed. */
export function rowString(row: unknown, key: string): string | undefined {
  const value = asRecord(row)[key];
  return typeof value === 'string' ? value : undefined;
}

function str(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function strOrNull(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function numOrNull(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  return typeof value === 'number' ? value : null;
}

/** `Array.isArray` narrows `unknown` to `any[]`; annotating the result keeps
 *  the elements `unknown` so nothing downstream inherits `any`. Same guard the
 *  shared `extractItems` normalizer uses. */
function arrayOf(value: unknown): unknown[] {
  const list: unknown[] = Array.isArray(value) ? value : [];
  return list;
}

function stringList(value: unknown): string[] {
  return arrayOf(value).filter((entry): entry is string => typeof entry === 'string');
}

// =============================================================================
// Shared nested-shape decoders (joins hydrated onto several row types).
// =============================================================================

/** `{ name, slug }` tag / category joins. Rows that carry only `name` (the
 *  chat-side row shape) keep their label and get an empty slug — the cards
 *  read `name` and nothing else. */
function namedSlugList(value: unknown): { name: string; slug: string }[] {
  const out: { name: string; slug: string }[] = [];
  for (const entry of arrayOf(value)) {
    const record = asRecord(entry);
    const name = strOrNull(record, 'name');
    if (name === null) continue;
    out.push({ name, slug: str(record, 'slug') });
  }
  return out;
}

const USER_PROFILE_DEFAULTS: UserProfile = {
  id: '',
  full_name: null,
  email: '',
  avatar_url: null,
  job_title: null,
  company: null,
  bio: null,
  employee_id: null,
  department_id: null,
  department: null,
  role: 'user',
  msp_id: null,
  created_at: '',
  updated_at: '',
};

/** The customer/author join on case studies + customer interviews. The cards
 *  read `full_name`, `avatar_url` and `job_title`; absent join → `undefined`,
 *  which is what those cards already fall back on. */
function decodeUserProfile(value: unknown): UserProfile | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = asRecord(value);
  return {
    ...USER_PROFILE_DEFAULTS,
    id: str(record, 'id'),
    full_name: strOrNull(record, 'full_name'),
    avatar_url: strOrNull(record, 'avatar_url'),
    job_title: strOrNull(record, 'job_title'),
  };
}

const MSP_DEFAULTS: MSP = { id: '', name: '', seat_count: 0, created_at: '', updated_at: '' };

/** The MSP join — cards read `name` and `icon_url`. */
function decodeMsp(value: unknown): MSP | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = asRecord(value);
  return {
    ...MSP_DEFAULTS,
    id: str(record, 'id'),
    name: str(record, 'name'),
    icon_url: rowString(record, 'icon_url'),
  };
}

/** The shared hydrated-author shape (`EntityAuthor`) — only `full_name` and
 *  `avatar_url` are required, so this needs no defaults literal. */
function decodeEntityAuthor(value: unknown): EntityAuthor | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = asRecord(value);
  return {
    id: rowString(record, 'id'),
    full_name: strOrNull(record, 'full_name'),
    avatar_url: strOrNull(record, 'avatar_url'),
    job_title: strOrNull(record, 'job_title'),
    about: strOrNull(record, 'about'),
    slug: rowString(record, 'slug'),
  };
}

/** Program hosts / speakers. `name` is the only required field; an entry
 *  without one is dropped rather than rendered as a nameless avatar. */
function decodeProgramHosts(value: unknown): ProgramHost[] | null {
  if (value == null) return null;
  const out: ProgramHost[] = [];
  for (const entry of arrayOf(value)) {
    const record = asRecord(entry);
    const name = strOrNull(record, 'name');
    if (name === null) continue;
    out.push({
      name,
      id: rowString(record, 'id'),
      email: rowString(record, 'email'),
      avatar_url: rowString(record, 'avatar_url'),
      bio: rowString(record, 'bio'),
      role: rowString(record, 'role'),
    });
  }
  return out;
}

// =============================================================================
// Per-type row decoders. Each reads the fields ITS card renders; every other
// required field comes from the type-annotated defaults literal above it.
// =============================================================================

function decodeBlogRow(row: unknown): BlogPostSummary {
  const record = asRecord(row);
  return {
    id: numOrNull(record, 'id') ?? 0,
    title: str(record, 'title'),
    slug: str(record, 'slug'),
    summary: strOrNull(record, 'summary'),
    featured_image: strOrNull(record, 'featured_image'),
    published_at: strOrNull(record, 'published_at'),
    author_name: strOrNull(record, 'author_name'),
    author_avatar: strOrNull(record, 'author_avatar'),
    categories: namedSlugList(record.categories),
    tags: namedSlugList(record.tags),
    view_count: numOrNull(record, 'view_count') ?? undefined,
  };
}

const CASE_STUDY_ROW_DEFAULTS: CaseStudy = {
  id: 0,
  title: '',
  slug: '',
  summary: null,
  featured_image: null,
  user_id: null,
  challenge: null,
  solution: null,
  results: null,
  testimonial_video_url: null,
  main_video_url: null,
  video_source_type: null,
  video_source: null,
  video_bites: [],
  customer_interview_id: null,
  seo_title: null,
  seo_description: null,
  seo_keywords: null,
  og_image_url: null,
  status: 'published',
  published_at: null,
  author_id: null,
  created_at: '',
  updated_at: '',
  view_count: 0,
};

function decodeCaseStudyRow(row: unknown): CaseStudy {
  const record = asRecord(row);
  return {
    ...CASE_STUDY_ROW_DEFAULTS,
    id: numOrNull(record, 'id') ?? 0,
    title: str(record, 'title'),
    summary: strOrNull(record, 'summary'),
    featured_image: strOrNull(record, 'featured_image'),
    msp: decodeMsp(record.msp),
    user: decodeUserProfile(record.user),
  };
}

const CUSTOMER_INTERVIEW_ROW_DEFAULTS: CustomerInterview = {
  id: 0,
  title: '',
  slug: '',
  video_summary: null,
  transcript: null,
  user_id: null,
  main_video_url: null,
  teasers: [],
  case_study_id: null,
  seo_title: null,
  seo_description: null,
  seo_keywords: null,
  og_image_url: null,
  featured_image: null,
  status: 'completed',
  completed_at: null,
  author_id: null,
  custom_instructions: null,
  created_at: '',
  updated_at: '',
  view_count: 0,
};

function decodeCustomerInterviewRow(row: unknown): CustomerInterview {
  const record = asRecord(row);
  return {
    ...CUSTOMER_INTERVIEW_ROW_DEFAULTS,
    id: numOrNull(record, 'id') ?? 0,
    title: str(record, 'title'),
    video_summary: strOrNull(record, 'video_summary'),
    main_video_url: strOrNull(record, 'main_video_url'),
    featured_image: strOrNull(record, 'featured_image'),
    msp: decodeMsp(record.msp),
    user: decodeUserProfile(record.user),
  };
}

const INVESTOR_UPDATE_ROW_DEFAULTS: InvestorUpdate = {
  id: '',
  title: '',
  slug: '',
  update_number: null,
  period_start: null,
  period_end: null,
  platform_id: null,
  content: null,
  video_summary: null,
  transcript: null,
  main_video_url: null,
  highlight_video_url: null,
  highlight_video_thumbnail: null,
  main_video_thumbnail: null,
  video_bites: [],
  featured_image: null,
  strategic_update: null,
  financials: {},
  metrics_snapshot: {},
  content_refs: [],
  highlights: null,
  section_visibility: {},
  status: 'published',
  published_at: null,
  author_id: null,
  seo_title: null,
  seo_description: null,
  seo_keywords: null,
  og_image_url: null,
  hubspot_email_id: null,
  custom_instructions: null,
  created_at: '',
  updated_at: '',
  created_by: null,
  updated_by: null,
};

function decodeInvestorUpdateRow(row: unknown): InvestorUpdate {
  const record = asRecord(row);
  return {
    ...INVESTOR_UPDATE_ROW_DEFAULTS,
    id: str(record, 'id'),
    title: str(record, 'title'),
    update_number: numOrNull(record, 'update_number'),
    period_start: strOrNull(record, 'period_start'),
    period_end: strOrNull(record, 'period_end'),
    content: strOrNull(record, 'content'),
    strategic_update: strOrNull(record, 'strategic_update'),
    featured_image: strOrNull(record, 'featured_image'),
  };
}

const ONBOARDING_GUIDE_ROW_DEFAULTS: OnboardingGuide = {
  id: '',
  title: '',
  slug: '',
  section: '',
  step_order: 0,
  section_order: 0,
  content: null,
  video_summary: null,
  transcript: null,
  transcript_words_data: null,
  srt_content: null,
  ai_transcript_formatted: null,
  main_video_url: null,
  main_video_thumbnail: null,
  youtube_url: null,
  highlight_video_url: null,
  highlight_video_thumbnail: null,
  highlight_video_duration_ms: null,
  highlight_video_source: null,
  video_bites: [],
  featured_image: null,
  og_image_url: null,
  seo_title: null,
  seo_description: null,
  seo_keywords: null,
  status: 'published',
  published_at: null,
  author_id: null,
  custom_instructions: null,
  config: null,
  ai_effort_score: null,
  created_at: '',
  updated_at: '',
  created_by: null,
  updated_by: null,
};

function decodeOnboardingGuideRow(row: unknown): OnboardingGuide {
  const record = asRecord(row);
  return {
    ...ONBOARDING_GUIDE_ROW_DEFAULTS,
    id: str(record, 'id'),
    title: str(record, 'title'),
    section: str(record, 'section'),
    step_order: numOrNull(record, 'step_order') ?? 0,
    content: strOrNull(record, 'content'),
    video_summary: strOrNull(record, 'video_summary'),
    featured_image: strOrNull(record, 'featured_image'),
    og_image_url: strOrNull(record, 'og_image_url'),
    main_video_thumbnail: strOrNull(record, 'main_video_thumbnail'),
    highlight_video_thumbnail: strOrNull(record, 'highlight_video_thumbnail'),
    highlight_video_duration_ms: numOrNull(record, 'highlight_video_duration_ms'),
    author: decodeEntityAuthor(record.author),
  };
}

/**
 * `RoadmapItem` is the one row type the card reads WHOLE, so this decoder
 * carries no defaults literal — every field is read off the row.
 *
 * `upvotes` / `downvotes` / `quarter` are required `number`/`string` props the
 * card renders directly. Read off an untyped row they were `any`, so a row
 * without them rendered the miss (a blank vote count). They now fall back to
 * `0` / `''`, matching how the card renders a genuinely zero-vote item.
 */
function decodeRoadmapRow(row: unknown): RoadmapItem {
  const record = asRecord(row);
  const assignees: NonNullable<RoadmapItem['assignees']> = [];
  for (const entry of arrayOf(record.assignees)) {
    const assignee = asRecord(entry);
    assignees.push({
      id: numOrNull(assignee, 'id') ?? 0,
      name: strOrNull(assignee, 'name'),
      avatarUrl: strOrNull(assignee, 'avatarUrl'),
    });
  }
  return {
    id: str(record, 'id'),
    title: str(record, 'title'),
    description: str(record, 'description'),
    status: str(record, 'status'),
    statusColor: str(record, 'statusColor'),
    icon: strOrNull(record, 'icon'),
    figmaUrl: strOrNull(record, 'figmaUrl'),
    screenshots: stringList(record.screenshots),
    targetVersion: strOrNull(record, 'targetVersion'),
    upvotes: numOrNull(record, 'upvotes') ?? 0,
    downvotes: numOrNull(record, 'downvotes') ?? 0,
    quarter: str(record, 'quarter'),
    clickupUrl: str(record, 'clickupUrl'),
    customItemId: numOrNull(record, 'customItemId'),
    assignees,
  };
}

/**
 * Program rows (podcast / webinar / event) keep their EXTRA columns.
 *
 * `<ProgramCard>` is generic over the item, and the config the rail threads in
 * is an `AnyProgramConfig` — `ProgramConfig<BaseProgramItem &
 * Record<string, unknown>>` — precisely so per-program columns ride along. The
 * card branches on `'duration_seconds' in item` / `'location_name' in item` /
 * `'start_at' in item`, so dropping the unrecognised columns would silently
 * strip a podcast's runtime and an event's venue. The raw row is spread first
 * and the base fields are decoded over it.
 */
function decodeProgramRow(row: unknown): BaseProgramItem & Record<string, unknown> {
  const record = asRecord(row);
  return {
    ...record,
    id: str(record, 'id'),
    title: str(record, 'title'),
    description: strOrNull(record, 'description'),
    cover_url: strOrNull(record, 'cover_url'),
    date: str(record, 'date'),
    external_url: strOrNull(record, 'external_url'),
    hosts: decodeProgramHosts(record.hosts),
  };
}

/** The two employee-entry cards already declare MINIMAL row shapes
 *  (`EmployeeEntryCardData` + one date column each), so their decoders read
 *  exactly the card's fields with nothing left over. */
function decodeEmployeeEntryRow(row: unknown): WhatIShippedCardData & HowIWorkCardData {
  const record = asRecord(row);
  return {
    title: strOrNull(record, 'title'),
    summary: strOrNull(record, 'summary'),
    status: strOrNull(record, 'status'),
    featured_image: strOrNull(record, 'featured_image'),
    main_video_thumbnail: strOrNull(record, 'main_video_thumbnail'),
    author: decodeEntityAuthor(record.author),
    entry_month: strOrNull(record, 'entry_month'),
    session_date: strOrNull(record, 'session_date'),
    discipline: strOrNull(record, 'discipline'),
  };
}

// =============================================================================
// Registry
// =============================================================================

/** Everything a card branch needs beyond its own row — computed once per card
 *  by the rail's dispatcher and shared by every entry. */
export interface RelatedCardContext {
  /** Card density for this group, from `CONTENT_REF_GROUPS`. */
  size: CardSize;
  /** `size` with `'lg'` collapsed to `'default'` — most card variants accept
   *  only that pair. */
  legacySize: 'default' | 'sm';
  href: string;
  targetPlatform: string | null;
  /** `null` = the host surfaced no URL; the card stays in non-anchor mode. */
  linkProps: CardLinkAnchorProps | null;
  /** `{ target, rel }` for the cards that take them as separate props. */
  anchorAttrs: Pick<CardLinkAnchorProps, 'target' | 'rel'>;
  /** Branded OG fallback for cards whose row has no featured image. */
  placeholderUrl?: string;
  extras?: ChatCardDispatchExtras;
}

/** One registered content type. `Row` is erased here — `cardEntry` below is
 *  what keeps each branch's row type concrete. */
export interface RelatedCardRegistryEntry {
  /** Sized to match the resolved card exactly (zero layout shift). */
  skeleton: (size: CardSize) => React.ReactNode;
  render: (row: unknown, ctx: RelatedCardContext) => React.ReactNode;
}

/**
 * Register one type with its OWN row type.
 *
 * `Row` is bound by the definition object and never escapes: `render` is
 * handed a decoded `Row`, and the stored entry exposes only
 * `(row: unknown) => ReactNode`. That is what lets a single registry hold ten
 * heterogeneous row shapes without a shared supertype — the job `item: any`
 * used to do, minus the promise it could not keep.
 */
function cardEntry<Row>(definition: {
  skeleton: (size: CardSize) => React.ReactNode;
  decode: (row: unknown) => Row;
  render: (row: Row, ctx: RelatedCardContext) => React.ReactNode;
}): RelatedCardRegistryEntry {
  return {
    skeleton: definition.skeleton,
    render: (row, ctx) => definition.render(definition.decode(row), ctx),
  };
}

/** Podcast / webinar / event share one card + one skeleton and differ only by
 *  which host-supplied `ProgramConfig` they render with. A group whose config
 *  the host didn't supply renders nothing (the skeleton still reserves its
 *  height, so a rail that never resolves collapses instead of flickering). */
function programEntry(configKey: 'podcast' | 'webinar' | 'event'): RelatedCardRegistryEntry {
  return cardEntry({
    skeleton: size => <ProgramCardSkeleton size={size === 'sm' ? 'sm' : 'default'} />,
    decode: decodeProgramRow,
    render: (item, ctx) => {
      const config = ctx.extras?.programConfigs?.[configKey];
      if (!config) return null;
      return (
        <ProgramCard
          config={config}
          item={item}
          size={ctx.legacySize}
          href={ctx.href}
          targetPlatform={ctx.targetPlatform}
          placeholderUrl={ctx.placeholderUrl}
          {...ctx.anchorAttrs}
        />
      );
    },
  });
}

/** The three ClickUp-backed types render the same card, distinguished by
 *  `cardType` (drives the compact icon slot). */
function roadmapEntry(cardType: 'roadmap_item' | 'delivery_item' | 'internal_task'): RelatedCardRegistryEntry {
  return cardEntry({
    skeleton: size => <RoadmapCardSkeleton size={size === 'sm' ? 'sm' : 'default'} />,
    decode: decodeRoadmapRow,
    render: (item, ctx) => (
      <RoadmapCard
        item={item}
        href={ctx.href}
        targetPlatform={ctx.targetPlatform}
        userVote={null}
        onVote={() => {}}
        size={ctx.legacySize}
        cardType={cardType}
        {...ctx.anchorAttrs}
      />
    ),
  });
}

export const RELATED_CARD_REGISTRY: Record<string, RelatedCardRegistryEntry> = {
  blog_post_existing: cardEntry({
    skeleton: size => <BlogCardSkeleton size={size === 'sm' ? 'sm' : 'default'} />,
    decode: decodeBlogRow,
    render: (post, ctx) => (
      <BlogCard
        post={post}
        size={ctx.legacySize}
        href={ctx.href}
        targetPlatform={ctx.targetPlatform}
        placeholderUrl={ctx.placeholderUrl}
        {...ctx.anchorAttrs}
      />
    ),
  }),

  case_study: cardEntry({
    skeleton: size => <CaseStudyCardSkeleton size={size === 'sm' ? 'sm' : 'default'} />,
    decode: decodeCaseStudyRow,
    render: (study, ctx) => (
      <CaseStudyCard
        study={study}
        size={ctx.legacySize}
        href={ctx.href}
        targetPlatform={ctx.targetPlatform}
        placeholderUrl={ctx.placeholderUrl}
        {...ctx.anchorAttrs}
      />
    ),
  }),

  customer_interview: cardEntry({
    skeleton: size => <CustomerInterviewCardSkeleton size={size === 'sm' ? 'sm' : 'default'} />,
    decode: decodeCustomerInterviewRow,
    render: (interview, ctx) => (
      <CustomerInterviewCard
        interview={interview}
        size={ctx.legacySize}
        href={ctx.href}
        targetPlatform={ctx.targetPlatform}
        placeholderUrl={ctx.placeholderUrl}
        {...ctx.anchorAttrs}
      />
    ),
  }),

  /**
   * Product releases derive their whole prop bundle through a HOST seam
   * (`extras.buildProductReleaseCardProps`, defaulting to the lib builder)
   * which already takes `unknown` — so this entry's row type is the bare
   * record, and the three props the rail sets itself are read off it.
   */
  product_release: cardEntry({
    skeleton: size => <ProductReleaseCardSkeleton size={size === 'sm' ? 'sm' : 'lg'} />,
    decode: asRecord,
    render: (release, ctx) => {
      const buildReleaseProps = ctx.extras?.buildProductReleaseCardProps ?? buildProductReleaseCardProps;
      const releaseProps = buildReleaseProps(release);
      return (
        <ProductReleaseCard
          size={ctx.size === 'sm' ? 'sm' : 'lg'}
          // `title` and `version` are REQUIRED `string` props. Read off an
          // untyped row they were `any`, so a release row missing either one
          // rendered an empty heading and a version pill reading "vundefined".
          // `summary` is `string | null | undefined` and the card renders
          // `summary ?? ''`, so a dropped one is indistinguishable from null.
          title={str(release, 'title')}
          summary={rowString(release, 'summary')}
          version={str(release, 'version')}
          {...releaseProps}
          // The card wraps in `<a {...anchorProps}>` ONLY when
          // `anchorProps.href` is set — `undefined` (not an empty object)
          // keeps it in non-anchor mode instead of rendering a dead <a>.
          anchorProps={ctx.linkProps ?? undefined}
        />
      );
    },
  }),

  podcast: programEntry('podcast'),
  webinar: programEntry('webinar'),
  event: programEntry('event'),

  investor_update: cardEntry({
    skeleton: size => <InvestorUpdateCardSkeleton size={size === 'sm' ? 'sm' : 'default'} />,
    decode: decodeInvestorUpdateRow,
    render: (update, ctx) => (
      <InvestorUpdateCard
        update={update}
        size={ctx.legacySize}
        href={ctx.href}
        targetPlatform={ctx.targetPlatform}
        placeholderUrl={ctx.placeholderUrl}
        {...ctx.anchorAttrs}
      />
    ),
  }),

  /** The rich CATALOG variant (hero + author grid, clamped description) — the
   *  step-numbered 'default' variant is for the guide detail page's "More in
   *  section" rail, not this full-width row. */
  onboarding_guide: cardEntry({
    skeleton: size => <OnboardingGuideCardSkeleton size={size === 'sm' ? 'sm' : 'catalog'} />,
    decode: decodeOnboardingGuideRow,
    render: (guide, ctx) => (
      <OnboardingGuideCard
        guide={guide}
        size={ctx.size === 'sm' ? 'sm' : 'catalog'}
        href={ctx.href}
        targetPlatform={ctx.targetPlatform}
        placeholderUrl={ctx.placeholderUrl}
        {...ctx.anchorAttrs}
      />
    ),
  }),

  /** THE single What I Shipped card — same lib component the people-hub
   *  dashboard renders. `anchorProps` makes the whole card a click-through
   *  (the rail is read-only — no owner actions). Only pass it with a REAL
   *  href: an object with `href: undefined` is still truthy and would wrap the
   *  card in a dead <a>. */
  what_i_shipped: cardEntry({
    skeleton: () => <WhatIShippedCardSkeleton />,
    decode: decodeEmployeeEntryRow,
    render: (entry, ctx) => (
      <WhatIShippedCard
        entry={entry}
        placeholderUrl={ctx.placeholderUrl}
        anchorProps={ctx.linkProps ?? (ctx.href ? { href: ctx.href, ...ctx.anchorAttrs } : undefined)}
      />
    ),
  }),

  /** Same shared employee-entry shape + anchor contract as What I Shipped. */
  how_i_work: cardEntry({
    skeleton: () => <HowIWorkCardSkeleton />,
    decode: decodeEmployeeEntryRow,
    render: (entry, ctx) => (
      <HowIWorkCard
        entry={entry}
        placeholderUrl={ctx.placeholderUrl}
        anchorProps={ctx.linkProps ?? (ctx.href ? { href: ctx.href, ...ctx.anchorAttrs } : undefined)}
      />
    ),
  }),

  roadmap_item: roadmapEntry('roadmap_item'),
  delivery_item: roadmapEntry('delivery_item'),
  internal_task: roadmapEntry('internal_task'),
};
