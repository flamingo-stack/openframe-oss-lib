/**
 * Trust Center wire types + vocabulary — the ONE contract between the hub's
 * `/api/trust-center` projection (Vanta snapshot → public-safe payload) and the
 * lib's `<TrustCenterPage>`.
 *
 * Server-safe (no React, no DOM): the hub DAL, route and chat mapper import it
 * from `@flamingo-stack/openframe-frontend-core/types`.
 *
 * PUBLICATION POLICY lives hub-side (`lib/data/trust-center-public.ts`); this
 * module only names the shape and the vocabulary every surface renders:
 *   - only PASSING controls are ever on the wire (Vanta's SHOW_OK_ONLY practice);
 *   - `percent` is present only when the hub decided it is publishable;
 *   - no totals, failing counts, owners, people or remediation text exist here.
 */
import { escapeRegExp } from '../utils/escape-regexp';
import type { Faq } from './faq';

/** Framework audit status. Label, badge colour and icon are owned HERE, once. */
export const TRUST_FRAMEWORK_STATUSES = [
  { status: 'certified', label: 'Certified', color: 'success', icon: 'shield-check' },
  { status: 'in_audit', label: 'In audit', color: 'cyan', icon: 'shield-check' },
  { status: 'in_progress', label: 'In progress', color: 'warning', icon: 'file-shield' },
  { status: 'planned', label: 'Planned', color: 'default', icon: 'file-shield' },
] as const;

export type TrustFrameworkStatus = (typeof TRUST_FRAMEWORK_STATUSES)[number]['status'];
export type TrustFrameworkStatusEntry = (typeof TRUST_FRAMEWORK_STATUSES)[number];

export function trustFrameworkStatusEntry(status: TrustFrameworkStatus): TrustFrameworkStatusEntry {
  return TRUST_FRAMEWORK_STATUSES.find(entry => entry.status === status) ?? TRUST_FRAMEWORK_STATUSES[3];
}

/**
 * Sections of the page, in reading order — the anchor ids (`#controls`) and the
 * sticky section rail. AI & data use comes first: it is an AI-native buyer's
 * first question (2026 trust-center practice: Anthropic, OpenAI, ElevenLabs).
 */
export const TRUST_CENTER_SECTIONS = [
  { id: 'ai', label: 'AI & data use' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'controls', label: 'Controls' },
  { id: 'documents', label: 'Documents' },
  { id: 'subprocessors', label: 'Subprocessors' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'Contact' },
] as const;

export type TrustCenterSectionId = (typeof TRUST_CENTER_SECTIONS)[number]['id'];

/** The product name and the brand-neutral tagline every surface shows (page, chat card, SEO, nav). */
export const TRUST_CENTER_TITLE = 'Trust Center';
export const TRUST_CENTER_TAGLINE = 'Security, privacy and AI governance.';

/** THE route path. The page default, chat card list-url and embed EPs all read it. */
export const TRUST_CENTER_API_PATH = '/api/trust-center';

/** How long a copy counts as fresh: the route's s-maxage AND the page's revalidate-on-visible. */
export const TRUST_CENTER_CACHE_SECONDS = 300;

/** Where the monitoring data is synced from (the page's `DataAttribution` line). */
export const TRUST_CENTER_DATA_SOURCE = 'Vanta';

/** The single chat card id (`[card://trust_center:main]`). */
export const TRUST_CENTER_CARD_ID = 'main';

/** Chat `documentType` of the trust-center card (`[card://trust_center:main]`). */
export const TRUST_CENTER_DOCUMENT_TYPE = 'trust_center';

/** Default public page route (the hub's `/trust-center`). The chat card links here
 *  unless the host re-homes the type through its `composeContentUrl` overrides. */
export const TRUST_CENTER_PAGE_PATH = '/trust-center';

/** Contact-form reason for a gated document request (HubSpot routing matches the prefix). */
export const TRUST_DOCUMENT_REQUEST_PREFIX = 'Request trust document';
export function trustDocumentContactReason(title: string): string {
  return `${TRUST_DOCUMENT_REQUEST_PREFIX}: ${title}`;
}

export interface TrustCenterFramework {
  /** Vanta shorthand, e.g. `soc2`. */
  id: string;
  label: string;
  status: TrustFrameworkStatus;
  reportPeriod?: string | null;
  /** Present ONLY when publishable (certified or at/above the hub threshold). */
  percent?: number;
}

export interface TrustCenterControl {
  id: string;
  name: string;
  description?: string | null;
}

export interface TrustCenterControlDomain {
  /** Human label, e.g. "Identification & authentication". */
  domain: string;
  controls: TrustCenterControl[];
}

export interface TrustCenterDocument {
  title: string;
  kind: string;
  access: 'public' | 'request';
  /** Absolute or host-relative URL for public documents. */
  url?: string | null;
  /** A public legal document's type (`privacy`, `terms`), so a HOST can route it to its own legal page. */
  legalDocType?: string | null;
}

export interface TrustCenterSubprocessor {
  name: string;
  purpose: string;
  location: string;
  category: string;
  url?: string | null;
}

/** An AI statement: one FAQ of the company's Vanta Trust Center, in its AI category. */
export interface TrustCenterAiPractice {
  /** The FAQ question. */
  label: string;
  /** The FAQ answer, as Vanta stores it. */
  value: string;
  /** The first statement of the category — the headline data-use commitment, marked with the success shield. */
  commitment?: boolean;
}

export interface TrustCenterPublic {
  frameworks: TrustCenterFramework[];
  controlDomains: TrustCenterControlDomain[];
  /** Names of approved policies only. */
  policies: string[];
  documents: TrustCenterDocument[];
  subprocessors: TrustCenterSubprocessor[];
  aiPractices: TrustCenterAiPractice[];
  faqs: Faq[];
  /** ISO instant: most recent passing test run (falls back to the pull time). */
  checkedAt: string | null;
  /** ISO instant: start of the last successful Vanta pull. */
  syncedAt: string | null;
  /** The client derives "monitored" as `now - syncedAt <= monitoredWindowMs` (a CDN copy can't lie). */
  monitoredWindowMs: number;
  /** False when Vanta is not connected / never synced — a config-only projection. */
  connected: boolean;
}

/** Client-side "monitored" rule (after mount only — never in SSR output). */
export function isTrustCenterMonitored(
  data: Pick<TrustCenterPublic, 'connected' | 'syncedAt' | 'monitoredWindowMs'>,
  nowMs: number,
): boolean {
  if (!data.connected || !data.syncedAt) return false;
  const synced = Date.parse(data.syncedAt);
  return Number.isFinite(synced) && nowMs - synced <= data.monitoredWindowMs;
}

/** "SOC 2 Type II: In progress · ISO 27001: Planned" — the ONE framework summary line (chat card, RAG mapper). */
export function trustFrameworksSummary(
  frameworks: ReadonlyArray<Pick<TrustCenterFramework, 'label' | 'status'>>,
): string {
  return frameworks.map(f => `${f.label}: ${trustFrameworkStatusEntry(f.status).label}`).join(' · ');
}

// ---------------------------------------------------------------------------
// Controls search — answered by the SERVER (`GET TRUST_CENTER_API_PATH?q=`).
// The page never filters: it renders what the route returns.
// ---------------------------------------------------------------------------

/** The route's search parameter. */
export const TRUST_CENTER_SEARCH_PARAM = 'q';
/** Longest query the route reads; the rest is ignored. */
export const TRUST_CENTER_SEARCH_MAX_CHARS = 100;
/** How long the page waits after the last keystroke before asking the server. */
export const TRUST_CENTER_SEARCH_DEBOUNCE_MS = 250;

/** The route's answer to `?q=`: the passing controls that match, grouped by category. */
export interface TrustCenterControlSearch {
  /** The query this answers (normalized), so a late answer to an older query is recognisable. */
  query: string;
  controlDomains: TrustCenterControlDomain[];
}

/** THE query normalization: trimmed and capped. Empty = no search. */
export function normalizeTrustControlQuery(query: string | null | undefined): string {
  return (query ?? '').trim().slice(0, TRUST_CENTER_SEARCH_MAX_CHARS);
}

/**
 * THE control matcher: the escaped query, case-insensitive, matched on the
 * ORIGINAL text (lowercasing first misaligns offsets wherever it changes a
 * string's length, `İ` → `i̇`). The server filters with it and the page
 * highlights with it, so a returned row always shows why it matched.
 */
export function trustControlQueryMatcher(query: string): RegExp | null {
  const needle = normalizeTrustControlQuery(query);
  return needle ? new RegExp(escapeRegExp(needle), 'iu') : null;
}

/** The controls whose name or description matches; empty categories dropped. Server-side only by convention. */
export function filterTrustControlDomains(
  domains: readonly TrustCenterControlDomain[],
  query: string,
): TrustCenterControlDomain[] {
  const matcher = trustControlQueryMatcher(query);
  if (!matcher) return [...domains];
  return domains
    .map(domain => ({
      ...domain,
      controls: domain.controls.filter(
        control => matcher.test(control.name) || matcher.test(control.description ?? ''),
      ),
    }))
    .filter(domain => domain.controls.length > 0);
}

/** The search URL for an endpoint (which may already carry a query string, e.g. an embed proxy). */
export function trustCenterSearchUrl(endpoint: string, query: string): string {
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}${TRUST_CENTER_SEARCH_PARAM}=${encodeURIComponent(normalizeTrustControlQuery(query))}`;
}
