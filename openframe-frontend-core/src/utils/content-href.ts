/**
 * The SINGLE content-href authority for every embeddable surface: the `ChatRuntime.composeContentUrl` seam. Page views
 * (onboarding catalog and detail, product releases) AND chat surfaces (entity cards, source chips, search results) all
 * resolve a content link through this one function, so a given content type lands in the SAME place wherever it is
 * rendered.
 *
 * The server answers every record's address (its `url`); a composer only decides whether this host has a page of its
 * own for the record. ONE composer for a host that embeds the hub's content, `makeEmbedderComposeContentUrl`; the hub
 * wires its own (cross-platform topology) to the same seam. Pure and server-safe (no React, no browser APIs).
 *
 *   composeContentUrl: makeEmbedderComposeContentUrl({
 *     contentOrigin: HUB_PUBLIC_ORIGIN,
 *     routes: { onboardingGuide: slug => `/onboarding-guides/${slug}`, knowledgeBase: '/docs' },
 *   })
 */

import { buildTicketOpenHref, DEV_SECTION_PARAM_KEYS } from './dev-sections/dev-section-param-keys';
import { sanitizeDocPath } from './doc-path-utils';
import { faqItemAnchor } from './faq-anchor';
import { canonicalContentRefType } from './list-url';

/** Input to the unified content-href seam. ONE object covers both callers:
 *  page views pass `type` + `identifier` (the slug); chat rows pass `type` +
 *  `identifier` (the primary-key id) + `externalUrl` (the canonical hub URL,
 *  from which the slug is recovered for in-app routing). */
export interface ComposeContentUrlInput {
  /** The content's CANONICAL documentType (e.g. `'product_release'`, `'blog_post'`). A rail-vocab alias
   *  (`'blog_post_existing'`) is canonicalized by the caller via `canonicalContentRefType` before it reaches the seam:
   *  a host names its pages against the canonical vocabulary, so an alias would miss them. */
  type: string;
  /** Content identifier. Page views pass the slug; chat rows pass the
   *  primary-key id (the slug is recovered from `externalUrl` when hosted). */
  identifier: string;
  /** Path segment when there is no `externalUrl` to recover the slug from: a doc's tree path, which
   *  `resolveSourceRowCTA` passes for a doc row with no url. `identifier` must stay the primary key (that is what
   *  `overrides` deep-link on), hence a separate field rather than overloading it. */
  slug?: string | null;
  /** Hydrated platform junction from the list APIs, for a composer that places a record by the platform it belongs to
   *  (the hub's). The embedder composer reads the server's address instead. */
  platforms?: Array<{ name?: string }>;
  /** The record's address as the server answers it (a chat row's or a list row's `url`). A record the host has a page
   *  for opens there; any other opens this address verbatim (authoritative). */
  externalUrl?: string | null;
  /** Platform that owns `externalUrl` (chat rows), for a composer that places a record by platform (the hub's). */
  targetPlatform?: string | null;
}

/** What the seam resolves a content reference to. */
export interface ComposedContentUrl {
  href: string;
  targetPlatform: string | null;
}

/** The unified `composeContentUrl` seam shape on `ChatRuntime`. ALWAYS returns
 *  a tuple (never null) — the seam type is non-nullable and callers read
 *  `.href` unconditionally. */
export type ComposeContentUrl = (input: ComposeContentUrlInput) => ComposedContentUrl;

/** The last segment of a detail page's address (`https://hub/releases/my-release` → `my-release`): the record's slug.
 *  Null for an address of one segment or none (a list page), and for a malformed one. */
function detailSlugOf(url: string): string | null {
  try {
    // Resolve against a dummy base so relative inputs parse too.
    const segments = new URL(url, 'https://_.local').pathname.split('/').filter(Boolean);
    return segments.length > 1 ? segments[segments.length - 1] : null;
  } catch {
    return null;
  }
}

/** The pages an embedder serves the hub's content on: each one it has is named, each one it has not is left out. */
export interface EmbedderContentRoutes {
  /** An onboarding guide's detail page, by its slug. */
  onboardingGuide?: (slug: string) => string;
  /** A product release's detail page, by its slug. */
  release?: (slug: string) => string;
  /** The docs viewer's base route: a product doc (`markdown`) opens there at its tree path. */
  knowledgeBase?: string;
  /** The roadmap list, opened filtered to the item (`?search=<id>`). */
  roadmap?: string;
  /** The bug fixes and enhancements list, opened filtered to the item. */
  delivery?: string;
  /** The FAQ page, opened at the question's anchor. */
  faqs?: string;
  /** The tickets list, opened with the ticket open (`buildTicketOpenHref`). */
  tickets?: string;
  /** The trust center page. */
  trustCenter?: string;
}

/**
 * THE composer of a host that embeds the hub's content (the OpenFrame app's Help Center, the embedding example): a record
 * the host has a page for opens there (a relative route, so it soft-navigates and stays on the host in every mode);
 * every other record opens the address the server answers, on the hub, in a new tab (`targetPlatform: null`: an
 * embedder is never a hub platform, so the tab decision is the origin's). One factory, so two embedders never encode
 * the same split twice; each names only its own pages.
 */
export function makeEmbedderComposeContentUrl({
  contentOrigin,
  routes,
}: {
  /** The hub's public origin, for a record the server gave no address. */
  contentOrigin: string;
  routes: EmbedderContentRoutes;
}): ComposeContentUrl {
  const search = (base: string, id: string) => `${base}?${DEV_SECTION_PARAM_KEYS.search}=${encodeURIComponent(id)}`;
  const own = (href: string): ComposedContentUrl => ({ href, targetPlatform: null });
  const detail: Record<string, ((slug: string) => string) | undefined> = {
    onboarding_guide: routes.onboardingGuide,
    product_release: routes.release,
  };
  const overrides: Record<string, (id: string) => ComposedContentUrl> = {};
  if (routes.roadmap) overrides.roadmap_item = id => own(search(routes.roadmap as string, id));
  if (routes.delivery) overrides.delivery_item = id => own(search(routes.delivery as string, id));
  if (routes.faqs) overrides.faq = id => own(`${routes.faqs}#${faqItemAnchor(id)}`);
  if (routes.tickets) {
    const ticket = (id: string) => own(buildTicketOpenHref(routes.tickets as string, id));
    overrides.hubspot_ticket = ticket;
    overrides.hubspot_ticket_self = ticket;
  }
  if (routes.trustCenter) overrides.trust_center = () => own(routes.trustCenter as string);
  const knowledgeBase = routes.knowledgeBase ? `/${routes.knowledgeBase.replace(/^\/+|\/+$/g, '')}` : null;

  return ({ type: rawType, identifier, slug, externalUrl }) => {
    // A stray alias (`blog_post_existing`) must not miss the host's pages: the canonicalizer `buildListUrl` uses.
    const type = canonicalContentRefType(rawType);
    const override = Object.prototype.hasOwnProperty.call(overrides, type) ? overrides[type] : undefined;
    if (override) return override(identifier);
    // A product doc opens in the host's viewer at its tree path: its id IS that path, and the url's last segment would
    // lose the tree.
    if (type === 'markdown' && knowledgeBase)
      return own(`${knowledgeBase}/${sanitizeDocPath(slug?.trim() || identifier)}`);
    // A record the host has a page for opens there, by its slug: read off the server's address (a chat row), else the
    // one a page view passes as `identifier`.
    const build = Object.prototype.hasOwnProperty.call(detail, type) ? detail[type] : undefined;
    if (build) return own(build((externalUrl && detailSlugOf(externalUrl)) || slug?.trim() || identifier));
    // Every other record opens the address the server answers, on the hub. One with none has no page of its own: the
    // hub, never a guessed path.
    return own(externalUrl || contentOrigin);
  };
}

/**
 * Default href shape when `runtime.composeContentUrl` is NOT wired
 * (single-platform embedders without cross-platform topology). Shared by
 * every catalog/detail view that composes a content link (onboarding guides,
 * product releases, …) so the no-composer fallback has ONE source — both
 * views pass their `basePath`-derived shape through here.
 */
export function buildDefaultHref(basePath: string, slug: string): { href: string; targetPlatform: string | null } {
  return { href: `${basePath}/${slug}`, targetPlatform: null };
}

/**
 * Resolve a content link via the host's `composeContentUrl` when wired, else the
 * same-origin `buildDefaultHref` fallback — the exact ternary every catalog/detail page
 * VIEW repeated. Centralizes the `composeContentUrl` input shape + the fallback in one
 * place so a future input-shape change lands once, not per view.
 */
export function resolveContentHref(
  composeContentUrl: ComposeContentUrl | undefined,
  args: {
    type: string;
    slug: string;
    basePath: string;
    platforms?: ComposeContentUrlInput['platforms'];
    /** The record's address as the server answers it (a list row's `url`), the same the chat's cards open. */
    url?: string | null;
  },
): { href: string; targetPlatform: string | null } {
  return composeContentUrl
    ? composeContentUrl({
        type: args.type,
        identifier: args.slug,
        platforms: args.platforms,
        ...(args.url ? { externalUrl: args.url } : {}),
      })
    : buildDefaultHref(args.basePath, args.slug);
}
