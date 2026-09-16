/**
 * Unified Program System Types
 *
 * Base interfaces and types for the Unified Program System that handles
 * events, podcasts, and webinars through a single set of generic components.
 *
 * Design Goals:
 *   1. Maximum Reuse: Single set of components works for all program types
 *   2. Type Safety: TypeScript generics ensure correct data shapes
 *   3. Configuration-Driven: Program types defined via configuration objects
 *   4. Admin Consistency: Same patterns work for public pages and admin CRUD
 *
 * Lifted from `lib/types/program-types.ts` in the hub.
 *
 * The pure row→item transform helpers that used to live here are GONE. They
 * had no caller in this package or in the host app, and the webinar one
 * hand-rolled `display_date_override ?? start_at` — the expression
 * `programDateInstant` exists to own — without setting the
 * `date_is_display_override` flag it needs, so an overridden webinar built
 * through it rendered with the clock and zone label the rule suppresses
 * everywhere else. A dead PUBLIC export that contradicts the rule is worse
 * than no export. The host app keeps its own transforms, which resolve.
 */

import type { ReactNode } from 'react';
import { toStripProfile, type VideoBiteStripProfile } from '../../../features/video-bites-shared';

// ============================================================================
// HOST TYPES
// ============================================================================

/**
 * Host/Speaker information for programs
 */
export interface ProgramHost {
  id?: string;
  name: string;
  email?: string;
  avatar_url?: string;
  bio?: string;
  role?: string; // e.g., "Host", "Speaker", "Guest"
}

/**
 * Client-safe author subset hydrated onto program items from the entity's
 * `author_id → profiles` FK join (podcast episodes / webinars). Deliberately
 * excludes `email` — this shape is serialized into public payloads.
 */
export interface ProgramAuthorRef {
  id?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  job_title?: string | null;
}

/**
 * Video-bites overlay profile for a program item: internal author first
 * (`author_id → profiles`), then the provider-synced primary host (Livestorm
 * speakers / Podbean hosts). Host `role` is a raw provider enum (e.g.
 * `team_member`) — never display copy, so it is not used as the subtitle.
 * Routes through `toStripProfile` (the SSoT — null on missing names).
 */
export function programItemToStripProfile(item: {
  author?: ProgramAuthorRef | null;
  hosts?: ProgramHost[] | null;
}): VideoBiteStripProfile | null {
  const fromAuthor = toStripProfile(item.author);
  if (fromAuthor) return fromAuthor;
  const host = Array.isArray(item.hosts) ? item.hosts[0] : null;
  if (!host?.name) return null;
  return toStripProfile({ full_name: host.name, avatar_url: host.avatar_url ?? null });
}

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

/**
 * Raw database row from luma_events table
 * Note: Many fields are optional to support partial queries
 * where not all columns are selected. The hosts field uses
 * unknown to accommodate JSON parsing from the database.
 */
export interface LumaEventRow {
  id: string;
  name: string;
  description?: string | null;
  cover_url?: string | null;
  start_at: string;
  end_at: string;
  timezone?: string | null;
  location_name?: string | null;
  location_full_address?: string | null;
  geo_latitude?: number | null;
  geo_longitude?: number | null;
  meeting_url?: string | null;
  event_url?: string | null;
  guest_count?: number | null;
  visibility?: string | null;
  hosts?: ProgramHost[] | null;
  platform_id: string;
  luma_api_id: string;
  is_deleted?: boolean;
}

/**
 * Raw database row from podcast_episodes table
 * Note: Many fields are optional to support partial queries
 * where not all columns are selected.
 */
export interface PodcastEpisodeRow {
  id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  published_at?: string | null;
  created_at: string;
  external_url?: string | null;
  hosts?: ProgramHost[] | null;
  platform_id: string;
  podbean_episode_id: string;
  podbean_podcast_id: string;
  audio_url?: string | null;
  /** Podbean-supplied source video URL (was `video_url` pre-rename). */
  main_video_url?: string | null;
  media_type?: 'audio' | 'video' | null;
  duration_seconds?: number | null;
  status?: string | null;
  is_deleted?: boolean;
  // Override fields (not synced by job)
  cover_image_override?: string | null;
  custom_video_url?: string | null;
}

/**
 * Raw database row from webinars table
 * Note: Many fields are optional to support partial queries
 * where not all columns are selected.
 */
export interface WebinarRow {
  id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  start_at: string;
  end_at?: string | null;
  timezone?: string | null;
  registration_url?: string | null;
  hosts?: ProgramHost[] | null;
  platform_id: string;
  livestorm_event_id: string;
  is_deleted?: boolean;
  /** Livestorm-supplied recording URL (was `recording_url` pre-rename). */
  main_video_url?: string | null;
  // Override fields (not synced by job)
  custom_video_url?: string | null;
  display_date_override?: string | null;
  cover_image_override?: string | null;
}

// ============================================================================
// BASE PROGRAM ITEM
// ============================================================================

/**
 * Base interface that all program items must implement
 * This enables the generic components to work across events, podcasts, and webinars
 */
export interface BaseProgramItem {
  id: string;
  title: string; // Maps to: name (events), title (podcasts/webinars)
  description: string | null;
  cover_url: string | null; // Primary image
  date: string; // ISO date string - maps to: start_at, published_at
  /**
   * True when an admin DISPLAY OVERRIDE supplied `date`, rather than the row's
   * own schedule — the flag `programDateInstant` reads to decide that this
   * value is a chosen DAY, rendered UTC-pinned with no clock and no zone.
   *
   * Declared HERE, on the type `ProgramCard` actually consumes, because while
   * it lived only in the host app's copy of this interface every consumer had
   * to cast past the type to read it — so the compiler could not tell anyone
   * when a producer forgot to set it.
   *
   * NOT the same as "is it a calendar date": the override column is
   * `timestamptz` and the host normalizes through `toISOString()`, so an
   * override always arrives as a full instant. An earlier attempt keyed off
   * value precision and could therefore never fire.
   */
  date_is_display_override?: boolean;
  /** The event's IANA zone, when the row declares one. Read through
   *  `programDateInstant`, never directly — see that module on why. */
  timezone?: string | null;
  external_url?: string | null; // Registration/play link
  hosts?: ProgramHost[] | null; // Speakers/hosts
  // Platform tagging lives in the host app's `entity_platforms` array (exposed
  // under the per-entity arrayKey, e.g. `podcast_platforms`), NOT a derived
  // singular `platform_id` on the item. ProgramCard routes via the `href` /
  // `targetPlatform` props the caller computes, so it needs no platform field here.
}

// ============================================================================
// PROGRAM-SPECIFIC INTERFACES
// ============================================================================

/**
 * Event-specific fields (from luma_events table)
 */
export interface EventItem extends BaseProgramItem {
  luma_api_id: string;
  end_at: string;
  timezone?: string | null;
  location_name?: string | null;
  location_full_address?: string | null;
  geo_latitude?: number | null;
  geo_longitude?: number | null;
  meeting_url?: string | null;
  event_url?: string | null;
  guest_count?: number | null;
  visibility?: string | null;
  is_deleted: boolean;
}

/**
 * Podcast episode fields (from podcast_episodes table)
 * Updated for Podbean video podcast support
 */
export interface PodcastItem extends BaseProgramItem {
  author_id?: string | null;
  podbean_episode_id: string;
  podbean_podcast_id: string;
  audio_url?: string | null;
  /** Podbean-supplied source video URL (was `video_url` pre-rename). */
  main_video_url?: string | null;
  media_type: 'audio' | 'video';
  duration_seconds?: number | null;
  status: string;
  published_at: string | null;
  is_deleted: boolean;
  podcast_url?: string | null; // Main podcast page URL from Podbean
  // Override fields (not synced by job)
  cover_image_override?: string | null;
  custom_video_url?: string | null;
  // Video processing fields
  transcript?: string | null;
  transcript_words_data?: unknown;
  srt_content?: string | null;
  video_summary?: string | null;
  video_bites?: unknown[];
  highlight_video_url?: string | null;
  highlight_video_source?: string | null;
  highlight_video_thumbnail?: string | null;
  highlight_video_duration_ms?: number | null;
  main_video_thumbnail?: string | null;
  config?: Record<string, unknown>;
  custom_instructions?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  ai_confidence_video_summary?: number | null;
  ai_confidence_transcript?: number | null;
}

/**
 * Webinar fields (from webinars table)
 */
export interface WebinarItem extends BaseProgramItem {
  author_id?: string | null;
  livestorm_event_id: string;
  start_at: string;
  end_at?: string | null;
  timezone?: string | null;
  registration_url?: string | null;
  is_deleted: boolean;
  /** Livestorm-supplied recording URL (was `recording_url` pre-rename). */
  main_video_url?: string | null;
  // Override fields (not synced by job)
  custom_video_url?: string | null;
  display_date_override?: string | null;
  cover_image_override?: string | null;
  // Video processing fields
  transcript?: string | null;
  transcript_words_data?: unknown;
  srt_content?: string | null;
  video_summary?: string | null;
  video_bites?: unknown[];
  highlight_video_url?: string | null;
  highlight_video_source?: string | null;
  highlight_video_thumbnail?: string | null;
  highlight_video_duration_ms?: number | null;
  main_video_thumbnail?: string | null;
  config?: Record<string, unknown>;
  custom_instructions?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  ai_confidence_video_summary?: number | null;
  ai_confidence_transcript?: number | null;
}

// ============================================================================
// PROGRAM CONFIGURATION
// ============================================================================

/**
 * Program type identifier
 */
export type ProgramType = 'event' | 'podcast' | 'webinar';

/**
 * Labels configuration for a program type
 */
export interface ProgramLabels {
  singular: string; // "Event", "Episode", "Webinar"
  plural: string; // "Events", "Episodes", "Webinars"
  upcoming: string; // "Next Event", "Latest Episode", "Upcoming Webinar"
  upcomingSection: string; // "Upcoming Events", "Upcoming Episodes", "Upcoming Webinars"
  archive: string; // "Past Events", "All Episodes", "Past Webinars"
  empty: string; // "No events yet", "No episodes yet", "No webinars yet"
}

/**
 * Configuration object that defines how a program type behaves
 * This is the core abstraction that enables generic components
 */
export interface ProgramConfig<T extends BaseProgramItem = BaseProgramItem> {
  type: ProgramType;
  labels: ProgramLabels;
  dateField: keyof T; // Which field to sort/filter by
  table: string; // Database table name
  apiEndpoint: string; // Base API path
  icon: ReactNode; // Section icon (CalendarDays, Mic, Video)
  platformIcon?: ReactNode; // External platform icon (optional)
  externalLinkLabel: string; // "View on Luma", "Listen on Podbean", "Watch on Livestorm"
  detailRoute: string; // "/events", "/podcasts", "/webinars"

  // Optional customization
  sortOrder?: 'asc' | 'desc'; // Default sort order for archive
  showInNav?: boolean; // Whether to show in navigation
  platformUrl?: string; // Fallback URL to external platform (e.g., Podbean main page)
  heroCoverAspect?: 'landscape' | 'square'; // Hero cover image aspect ratio (default: 'landscape')
}

// ============================================================================
// GENERIC DATA TYPES
// ============================================================================

/**
 * Generic response for program list queries
 */
export interface ProgramListResponse<T extends BaseProgramItem> {
  items: T[];
  count: number;
  hasMore?: boolean;
}

/**
 * Generic response for single program queries
 */
export interface ProgramItemResponse<T extends BaseProgramItem> {
  item: T;
  media?: ProgramMedia[];
}

/**
 * Program media (photos, videos, etc.)
 */
export interface ProgramMedia {
  id: string;
  program_id: string;
  media_type: 'image' | 'video' | 'audio';
  media_url: string;
  title?: string | null;
  description?: string | null;
  display_order: number;
  created_at: string;
}

// ============================================================================
// FILTER AND QUERY TYPES
// ============================================================================

/**
 * Filter options for program queries
 */
export interface ProgramFilter {
  filter: 'upcoming' | 'past' | 'all';
  limit?: number;
  offset?: number;
  search?: string;
}

/**
 * Admin query options
 */
export interface AdminProgramFilter extends ProgramFilter {
  includeDeleted?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// TRANSFORM UTILITIES
// ============================================================================
