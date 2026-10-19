'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAssistantRuntime } from '../../contexts/assistant-runtime-context';
import Link from '../../embed-shims/next-link';
import { useScrollToHash } from '../../hooks/use-scroll-to-hash';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import type { Faq } from '../../types/faq';
import { cn } from '../../utils/cn';
import { serializeJsonLd } from '../../utils/common';
import { faqSectionSlug, parseFaqHash, type FaqHashTarget } from '../../utils/faq-anchor';
import { navigateSamePageHash, STICKY_HEADER_OFFSET_PX } from '../../utils/same-page-hash-nav';
import { buildSuggestionUrl } from '../../utils/suggestion-url';
import { FAQ_ACCORDION_SKELETON_ROWS, FaqAccordion, FaqAccordionSkeleton, type FaqItem } from '../faq-accordion';
import { SECTION_HEADING_CLASS } from '../layout/page-heading';
import { LoadingRegion } from '../loading/loading-region';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from '../ui/loading-scope';
import { FaqAskCard, faqAskCardShown, type FaqAskOptions } from './faq-ask-card';
import { buildFaqJsonLdFromFaqs, type FaqSchemaOptions } from './json-ld';

export interface FaqSectionProps {
  /**
   * SSR hydrate. When provided, the hook skips the first client fetch (per
   * useSelfFetch contract). The consuming server page resolves FAQs then drills
   * them into this prop — the lib never re-fetches what the host already gated on.
   */
  initialFaqs?: Faq[];
  /** Both required together for entity-attached FAQs; partial → bare /api/faqs. */
  entityType?: string;
  entityId?: number | string;
  /**
   * What the page this FAQ sits on is about: ANY string the host's FAQ
   * endpoint knows. ONE topic for the whole block: the questions are the FAQs
   * written for it (`/api/faqs?topic=`; `initialFaqs` are then the host's read
   * of the same topic) and the "ask the assistant" card offers the questions
   * written for it. Whoever renders the FAQ states it; the lib names none.
   * Ignored for the questions when the FAQ is attached to an entity.
   */
  topic?: string;
  /**
   * Heading node above the grouped list. `undefined` → default
   * `<h2>`"Frequently Asked Questions". `null` → no heading (the host page
   * owns the `<h1>`, as the standalone /faqs surface does). A React node lets a
   * platform drill its own <PageHeading> without the lib referencing platform
   * state. Also drives category nesting so the document outline stays correct:
   * `null` → categories render `<h2>` (directly under the page `<h1>`);
   * otherwise categories render `<h3>` beneath this heading.
   */
  heading?: React.ReactNode | null;
  /** Inject FAQPage schema.org JSON-LD as a <script>. Off by default so embeds
   *  don't emit duplicate schema. */
  emitJsonLd?: boolean;
  /** Overrides for the JSON-LD's name/description/url. */
  jsonLd?: FaqSchemaOptions;
  className?: string;
  /** The `id` of the rendered section: what an in-page link to the FAQ points at (`PAGE_FAQ_SECTION_ID` for a page's own block). */
  id?: string;
  /**
   * Print the topic's bare name in small muted text under the heading
   * (`pricing`), so whoever edits the FAQs can see which topic a page asks
   * for. Default off. The section always carries it as `data-faq-topic` too.
   */
  showTopic?: boolean;
  /** Maps to /api/faqs `?count=` (the 5-tier fill target). Absent → param
   *  not sent (server default applies). */
  minResults?: number;
  /** Fetch-URL prefix for third-party embeds / reverse proxies
   *  ('' = same-origin relative). */
  apiBaseUrl?: string;
  /**
   * A block beside the questions, in place of the "ask the assistant" card.
   * From the content `lg` step the heading, the category nav and this block
   * form a left column and the questions the right one; below it the block
   * follows the questions.
   */
  aside?: React.ReactNode;
  /**
   * The "ask the assistant" card beside the questions. Shown wherever the
   * host's assistant runtime says a chat is there to open
   * (`AssistantRuntimeContext`: its name, glyph, questions endpoint and
   * opener) AND the FAQ has a topic: the block's `topic`, else the
   * `entityType` the FAQ is attached to (`ask.topic` states another one for
   * the card alone). No runtime or no topic: the FAQ is the single column it
   * always was; the lib names no topic of its own. `false` switches the card off; the object
   * also states the questions to leave out, the wording and the chat it opens
   * (`onOpen`). An `aside` takes the card's place.
   */
  ask?: false | FaqAskOptions;
  /**
   * The loading state's groups of questions, in order: THE one way to say what the skeleton draws (see
   * `FaqSkeletonShape`). Absent: one group with no category heading, of `minResults` rows (else one screen of rows).
   */
  skeletonShape?: FaqSkeletonShape;
  /**
   * The host's FAQs fall into named categories, so the loaded block draws its category nav (the platform's full,
   * categorised list): the loading state draws the nav's row too, so what follows it (the ask card) does not move.
   * Default false (a nav only when `skeletonShape` names two or more categories).
   */
  skeletonNav?: boolean;
}

const DEFAULT_HEADING_TEXT = 'Frequently Asked Questions';

/** The block's layout, read by the block and by its skeleton, so the skeleton is the block's size. */
const SECTION_DEFAULT_CLASS = 'space-y-10';
/** The nav's gap to its neighbour, inside the nav's own wrapper (padding), so the nav takes its gap with it. */
const NAV_ABOVE_QUESTIONS_CLASS = 'pb-8';
const NAV_BELOW_HEADING_CLASS = 'pt-8';
const QUESTIONS_STACK_CLASS = 'space-y-10';
// `grid-cols-1` (a `minmax(0, 1fr)` track): one column never grows to a child's content width (the nav skeleton's
// one-line pill row is wider than a phone).
const ASIDE_GRID_CLASS =
  'grid grid-cols-1 gap-10 content-lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] content-lg:grid-rows-[auto_1fr] content-lg:gap-x-16';
const ASIDE_QUESTIONS_CELL_CLASS = 'content-lg:col-start-2 content-lg:row-span-2 content-lg:row-start-1';
const ASIDE_CELL_CLASS = 'content-lg:col-start-1 content-lg:row-start-2';
const TOPIC_STACK_CLASS = 'space-y-1';
const TOPIC_CLASS = 'text-ods-text-muted text-h6';
const CATEGORY_NAV_CLASS = 'flex flex-wrap gap-2';
/**
 * The nav's row while the categories are read (`skeletonNav`): which categories there are, and how many, is read data,
 * so the skeleton draws ONE line of pills, the pills that do not fit cut off at its edge (never wrapped to a second
 * line). `FAQ_NAV_SKELETON_PILLS` is more than the widest column holds on one line.
 */
const CATEGORY_NAV_SKELETON_LINE_CLASS = 'flex min-w-0 flex-nowrap gap-2 overflow-hidden';
const FAQ_NAV_SKELETON_PILLS = 8;
const CATEGORY_PILL_CLASS = 'rounded-full border px-4 py-2 transition-colors text-h6';
const CATEGORY_SECTION_CLASS = 'scroll-mt-24';
/**
 * A category's heading, with the gap to its questions inside its own box (padding, not the group's spacing): only a
 * named group has one, so it is the group's optional part (`data-loading-optional`) and takes its gap with it, unless
 * the host declared its FAQs categorised (`skeletonNav`): then every group it draws is named, loading and loaded.
 */
const CATEGORY_HEADING_CLASS = cn(SECTION_HEADING_CLASS, 'pb-4');
/** Questions the block's skeleton draws when the host states no count (`minResults`): one screen of the accordion's rows. */
export const FAQ_SECTION_SKELETON_QUESTIONS = FAQ_ACCORDION_SKELETON_ROWS;

/** One group of questions the FAQ's loading state draws. */
export interface FaqSkeletonGroup {
  /** The group is a named category: drawn with its heading bar (and counted for the category nav). Default false. */
  heading?: boolean;
  /** Question rows the group draws. Default `FAQ_SECTION_SKELETON_QUESTIONS`, one screen of rows. */
  rows?: number;
}

/**
 * What the FAQ's loading state draws, group by group in order: the one shape `FaqSection`, `FaqSectionSkeleton`,
 * `FaqDocumentPage` and `TrustCenterPage` take. Stated by the host from what it knows before the read (its FAQs are
 * filed in categories, the server's page size), never copied from today's FAQs.
 */
export type FaqSkeletonShape = readonly FaqSkeletonGroup[];

/**
 * The block's arrangement, for the loaded list and its skeleton alike: without an aside the category nav above the
 * questions; with one, heading and nav in a left column, questions on the right, the aside under the left column.
 */
function FaqLayout({
  heading,
  nav,
  navDeclared = false,
  questions,
  aside,
}: {
  heading?: React.ReactNode;
  nav?: React.ReactNode;
  /** The host states its FAQs are categorised (`skeletonNav`): the nav is drawn loading and loaded, never optional. */
  navDeclared?: boolean;
  questions: React.ReactNode;
  aside?: React.ReactNode;
}) {
  // The category nav is drawn only when the FAQs fall into two or more categories: a part of the record
  // (`data-loading-optional`), carrying its own gap, unless the host declared it (`navDeclared`).
  const optional = navDeclared ? undefined : true;
  if (!aside) {
    return (
      <div>
        {nav && (
          <div className={NAV_ABOVE_QUESTIONS_CLASS} data-loading-optional={optional}>
            {nav}
          </div>
        )}
        {questions}
      </div>
    );
  }
  // One instance of each block, placed by the grid: questions second in the
  // document (and on a narrow area), in the right column from `lg`.
  return (
    <div className={ASIDE_GRID_CLASS}>
      <div>
        {heading}
        {nav && (
          <div className={NAV_BELOW_HEADING_CLASS} data-loading-optional={optional}>
            {nav}
          </div>
        )}
      </div>
      <div className={ASIDE_QUESTIONS_CELL_CLASS}>{questions}</div>
      <div className={ASIDE_CELL_CLASS}>{aside}</div>
    </div>
  );
}

/** The heading above the questions: the host's node (or the default `<h2>`), with the topic's bare name under it. */
function faqHeadingNode(heading: React.ReactNode | null | undefined, showTopic: boolean, topic?: string) {
  // `undefined` → default <h2> title; `null` → the host page owns the <h1>, so no title renders here.
  const titleNode = heading === undefined ? <h2 className={SECTION_HEADING_CLASS}>{DEFAULT_HEADING_TEXT}</h2> : heading;
  if (!(showTopic && topic)) return titleNode;
  // The host's heading may arrive from a server component, still streaming: React cannot check such a
  // node when it sits in a list of siblings and warns about a missing key. So it is the ONLY child of its
  // own wrapper, and the two siblings here are this component's own elements.
  return (
    <div className={TOPIC_STACK_CLASS}>
      <div>{titleNode}</div>
      <p className={TOPIC_CLASS}>{topic}</p>
    </div>
  );
}

/** The id of a page's own FAQ block: what a page's "FAQ" link or section nav points at. */
export const PAGE_FAQ_SECTION_ID = 'faq';

/** A page's own FAQ block inside a page that already provides the container: vertical rhythm only. */
const PAGE_FAQ_IN_PAGE_CLASS = 'space-y-10 pt-12 md:pt-20';

/**
 * What a shared page of the lib takes as its `faq` prop: the topic the page is
 * about (REQUIRED, stated by the host, never read from the page's address) and
 * where the host serves the FAQs. The page renders `FaqSection` with it, inside
 * its own container, after its content (`pageFaqProps`).
 */
export type PageFaqSlot = Pick<
  FaqSectionProps,
  'apiBaseUrl' | 'initialFaqs' | 'heading' | 'ask' | 'emitJsonLd' | 'jsonLd' | 'showTopic'
> & { topic: string };

/** The `FaqSection` props of a shared page's own FAQ block: the host's slot, as the page's `#faq` section. */
export function pageFaqProps(faq: PageFaqSlot): FaqSectionProps {
  return { ...faq, id: PAGE_FAQ_SECTION_ID, className: PAGE_FAQ_IN_PAGE_CLASS };
}

/** URL composition shared with RelatedContentSection (`buildSuggestionUrl`)
 *  — byte-identical to the historical `buildFaqsUrl` output when
 *  `minResults`/`apiBaseUrl` are absent. */
function buildFaqsUrl(
  entityType?: string,
  entityId?: number | string,
  minResults?: number,
  apiBaseUrl = '',
  topic?: string,
): string {
  // An entity's FAQs are the entity's: a topic narrows only the platform's own list.
  const entityScoped = !!entityType && entityId !== undefined && entityId !== null && entityId !== '';
  return buildSuggestionUrl('/api/faqs', {
    apiBaseUrl,
    entityType,
    entityId,
    count: minResults,
    extraParams: entityScoped ? undefined : { topic },
  });
}

interface FaqGroup {
  /** null → the uncategorized bucket: no heading, no jump pill, rendered last. */
  section: string | null;
  slug: string | null;
  items: FaqItem[];
}

/** Group FAQs by `faq.section`, preserving the server's first-seen
 *  (display_order) order for BOTH the section order and the rows within each
 *  section. The uncategorized bucket (blank/missing section) sinks to the end
 *  since it renders without a heading. Items carry NO badge here — the `<h2>`
 *  IS the category, so a per-row chip would be redundant. */
function groupFaqsBySection(faqs: Faq[]): FaqGroup[] {
  // A Map iterates in insertion order, which is exactly the first-seen section
  // order this function promises — so the Map IS the ordering, and no parallel
  // array of names (plus a lookup that has to assert the key back) is needed.
  const byName = new Map<string, FaqGroup>();
  let uncategorized: FaqGroup | null = null;
  for (const faq of faqs) {
    const item: FaqItem = { id: faq.id, question: faq.question, answer: faq.answer };
    const name = faq.section?.trim();
    if (!name) {
      if (!uncategorized) uncategorized = { section: null, slug: null, items: [] };
      uncategorized.items.push(item);
      continue;
    }
    let group = byName.get(name);
    if (!group) {
      group = { section: name, slug: faqSectionSlug(name), items: [] };
      byName.set(name, group);
    }
    group.items.push(item);
  }
  const groups = [...byName.values()];
  if (uncategorized) groups.push(uncategorized);
  return groups;
}

/** Map key for the uncategorized bucket — `group.slug` is null for it, so
 *  every per-group map (default-open ids, accordion keys) uses this sentinel
 *  to keep the lookup typed. */
const UNCATEGORIZED_KEY = '__uncategorized__';
const groupKey = (g: FaqGroup): string => g.slug ?? UNCATEGORIZED_KEY;

/**
 * Grouped FAQ layout: a category jump-nav above stacked `<h2>` category
 * sections (each its own accordion). Isolated into its own component so the
 * scroll-spy hooks only mount in grouped mode — `FaqSection`'s own hooks stay
 * unconditional.
 *
 * The pills are real `<a href="#slug">` anchors (crawlable in-page links,
 * deep-linkable, work without JS); the click handler upgrades the jump to the
 * cancellation-proof `scrollElementIntoView` tween and syncs the URL hash.
 */
function GroupedFaqList({
  groups,
  categoryHeadingAs,
  heading,
  aside,
  navDeclared,
}: {
  /** The host declared the category nav (`skeletonNav`). */
  navDeclared?: boolean;
  /** With `aside`, the section heading: it sits in the left column above the category nav. */
  heading?: React.ReactNode;
  aside?: React.ReactNode;
  groups: FaqGroup[];
  /** Heading tag for each category, so the document outline nests correctly
   *  under whatever owns the heading above this block: `h2` on the standalone
   *  page (the page owns the `<h1>`), `h3` beneath an embed's `<h2>` title.
   *  The VISUAL is `SECTION_HEADING_CLASS` either way, so categories look
   *  identical on every surface. */
  categoryHeadingAs: 'h2' | 'h3';
}) {
  const CategoryHeading = categoryHeadingAs;
  const navGroups = useMemo(() => groups.filter(g => g.slug), [groups]);
  const [activeSlug, setActiveSlug] = useState<string | null>(navGroups[0]?.slug ?? null);
  // Identity-stable key for the section set so the observer re-binds only when
  // the categories actually change (not on every parent re-render).
  const slugKey = navGroups.map(g => g.slug).join('|');
  // Latest `navGroups` for the scroll-spy observer below, which re-observes on
  // `slugKey` (the section SET) and must not re-run when the array is merely
  // rebuilt with the same slugs.
  const navGroupsRef = useRef(navGroups);
  useEffect(() => {
    navGroupsRef.current = navGroups;
  });

  // Scroll-spy: mark the pill for the category currently at the top of the
  // viewport. rootMargin drops the trigger line just below the sticky header
  // and ignores the bottom ~55% so "active" is the section being read, not the
  // next one peeking in.
  useEffect(() => {
    if (navGroupsRef.current.length < 2) return undefined;
    const tops = new Map<string, number>();
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) tops.set(id, entry.boundingClientRect.top);
          else tops.delete(id);
        }
        let bestId: string | null = null;
        let bestTop = Number.POSITIVE_INFINITY;
        for (const [id, top] of tops) {
          if (top < bestTop) {
            bestTop = top;
            bestId = id;
          }
        }
        if (bestId) setActiveSlug(bestId);
      },
      { rootMargin: `-${STICKY_HEADER_OFFSET_PX}px 0px -55% 0px`, threshold: 0 },
    );
    for (const group of navGroupsRef.current) {
      const el = group.slug ? document.getElementById(group.slug) : null;
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // slugKey encodes the section set; re-observe only when it changes.
  }, [slugKey]);

  // ─── Hash dispatch — `/faqs#faq-item-<id>` or `/faqs#faq-<section-slug>` ──
  // Tracks the current hash so:
  //   1. an item-kind hash seeds `defaultOpenIds` on the matching accordion
  //      (auto-expands the cited question);
  //   2. either kind triggers the cancellation-proof tween scroll with the
  //      sticky-header offset (native browser hash scroll runs once, ignores
  //      our offset — re-running the tween puts the target in the right spot).
  // Listens to `hashchange` so back/forward replays the same behavior. SSR-
  // safe: initial null state matches the server render; the first effect
  // tick on the client updates it.
  const [hashTarget, setHashTarget] = useState<FaqHashTarget | null>(null);
  useEffect(() => {
    const refresh = () => setHashTarget(parseFaqHash(window.location.hash));
    refresh();
    window.addEventListener('hashchange', refresh);
    return () => window.removeEventListener('hashchange', refresh);
  }, []);

  // Per-group default-open set when the hash points at an item. The map key
  // matches `groupKey(group)` so the render-time lookup is O(1) per group.
  const defaultOpenByGroupKey = useMemo(() => {
    if (hashTarget?.kind !== 'item') return null;
    const targetId = hashTarget.rawId;
    const result = new Map<string, (string | number)[]>();
    for (const group of groups) {
      const hit = group.items.find(i => String(i.id) === targetId);
      if (hit) result.set(groupKey(group), [hit.id]);
    }
    return result.size > 0 ? result : null;
  }, [groups, hashTarget]);

  // Accordion is uncontrolled — `defaultOpenIds` is only consumed at mount,
  // so a new item hash needs a remount to honor it. Keying off the item-id
  // suffix triggers exactly the remount we need (and stays stable when the
  // hash points at a section, so category navigation never disturbs the
  // accordion's open state).
  const accordionKeySuffix = hashTarget?.kind === 'item' ? `item:${hashTarget.rawId}` : 'default';

  // Unified scroll-to-hash: rAF-polls for the target row (outlasts the SWR self-fetch
  // + Radix accordion expand) and re-fires on `hashchange` — including the synthetic
  // event `navigateSamePageHash` dispatches for a SOFT same-page chat-card nav (a
  // host-router `pushState` fires no `hashchange`). The ready-dep keys off BOTH the
  // loaded `groups` (so a deep-link / refresh scrolls once the self-fetched list
  // mounts) AND `hashTarget` (so a soft nav re-runs the scroll AFTER the re-render
  // that remounts + opens the cited row, landing on its FINAL expanded position
  // instead of racing the uncontrolled accordion's key-remount — the bare-`hashchange`
  // listener alone fires before the remount and lands on the stale closed position).
  const scrollDep =
    `${groups.length}|` +
    (hashTarget?.kind === 'item'
      ? `item:${hashTarget.rawId}`
      : hashTarget?.kind === 'section'
        ? `section:${hashTarget.slug}`
        : 'none');
  useScrollToHash(scrollDep, { headerOffset: STICKY_HEADER_OFFSET_PX });

  // A section hash also lights up its category pill; item hashes leave the pills
  // untouched so deep-linking a question never disturbs scroll-spy state.
  //
  // Adjusted while rendering (React's prop-sync pattern) rather than from an
  // effect: the pills below read `activeSlug` in THIS render, so an effect
  // painted the OLD pill lit and then re-rendered to move the highlight. The
  // initial value matches `hashTarget`'s own initial `null`, so a mount is a
  // no-op here exactly as the effect's first run was.
  const [pillSyncedHash, setPillSyncedHash] = useState(hashTarget);
  if (pillSyncedHash !== hashTarget) {
    setPillSyncedHash(hashTarget);
    if (hashTarget?.kind === 'section') setActiveSlug(hashTarget.slug);
  }

  // Category pill click. `navigateSamePageHash` owns the entire transition:
  // replaceState → synthetic `hashchange` → `scrollElementIntoView` tween
  // with `STICKY_HEADER_OFFSET_PX` so the section heading lands BELOW the
  // sticky category nav on the FIRST tween (covers the same-target
  // re-click case, where the `hashTarget` effect at L214 is a no-op
  // because the state reference is equal). For DIFFERENT-target clicks
  // the helper's synthetic `hashchange` re-fires that effect, which
  // re-scrolls with the same offset and cancels this tween (singleton)
  // — both paths land at the same position. The effect is still
  // required for back/forward + direct URL edits, where the helper
  // isn't in the call chain.
  //
  // `history: 'replace'` matches the pre-helper behavior: category pills
  // are a TOC, not a navigation step, so the Back button leaves the
  // FAQ page in one step regardless of how many categories the user
  // clicked through.
  const handleJump = useCallback((e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    e.preventDefault();
    navigateSamePageHash('#' + slug, {
      headerOffset: STICKY_HEADER_OFFSET_PX,
      history: 'replace',
    });
  }, []);

  const categoryNav = navGroups.length > 1 && (
    <nav aria-label="FAQ categories" className={CATEGORY_NAV_CLASS}>
      {navGroups.map(group => {
        const isActive = group.slug === activeSlug;
        return (
          <Link
            key={group.slug}
            href={`#${group.slug}`}
            aria-current={isActive ? 'true' : undefined}
            onClick={e => handleJump(e, group.slug as string)}
            className={cn(
              CATEGORY_PILL_CLASS,
              isActive
                ? 'border-ods-text-primary bg-ods-card text-ods-text-primary'
                : 'border-ods-border bg-ods-card text-ods-text-secondary hover:border-ods-text-secondary hover:text-ods-text-primary',
            )}
          >
            {group.section}
          </Link>
        );
      })}
    </nav>
  );
  const questions = (
    <div className={QUESTIONS_STACK_CLASS}>
      {groups.map(group => {
        const key = groupKey(group);
        return (
          // A category is a record's group: how many there are is the data's (`data-loading-item`, like a list row).
          <section key={key} id={group.slug ?? undefined} className={CATEGORY_SECTION_CLASS} data-loading-item>
            {/* Only a named group has a heading (the uncategorized one has none): a part of the record, not of every group. */}
            {group.section && (
              <CategoryHeading
                className={CATEGORY_HEADING_CLASS}
                data-loading-optional={navDeclared ? undefined : true}
              >
                {group.section}
              </CategoryHeading>
            )}
            <FaqAccordion
              // Re-key on item-hash changes so the remount picks up the new
              // `defaultOpenIds` (the accordion is uncontrolled). Stable for
              // section hashes — category navigation doesn't disturb state.
              key={`${key}:${accordionKeySuffix}`}
              items={group.items}
              defaultOpenIds={defaultOpenByGroupKey?.get(key)}
            />
          </section>
        );
      })}
    </div>
  );

  return (
    <FaqLayout heading={heading} nav={categoryNav} navDeclared={navDeclared} questions={questions} aside={aside} />
  );
}

interface FaqsResponse {
  faqs: Faq[];
}

/**
 * The FAQ display surface — ONE rendering on every host: the list grouped by
 * `faq.section` (each category a heading + its own accordion, with a category
 * jump-nav once there are 2+ categories). There is no flat/ungrouped mode and
 * no page-vs-embedded shell fork; the standalone /faqs page and every embed
 * render through this single path, so they cannot drift.
 *
 * - Standalone /faqs page: pass `initialFaqs` (SSR) + `heading={null}` (the
 *   page owns the <h1>) + `emitJsonLd` with `jsonLd` overrides for SEO.
 * - Per-entity embed: pass `entityType` + `entityId` (no `initialFaqs`); the
 *   hook self-fetches `GET /api/faqs`, and `heading` is this block's own <h2>.
 * - A page's own FAQ: pass `topic` (what the page is about); the hook
 *   self-fetches `GET /api/faqs?topic=`, and the ask card takes the same topic.
 *
 * CONTRACT: the consuming app MUST implement `GET /api/faqs`. On a fetch error
 * (or zero FAQs) the component renders nothing so the host page isn't
 * disfigured. The host always supplies the page shell — this renders a bare
 * <section>.
 */
export function FaqSection({
  initialFaqs,
  entityType,
  entityId,
  topic,
  heading,
  emitJsonLd = false,
  jsonLd,
  className,
  id,
  showTopic = false,
  minResults,
  apiBaseUrl = '',
  aside: asideProp,
  ask,
  skeletonShape,
  skeletonNav = false,
}: FaqSectionProps) {
  const assistant = useAssistantRuntime();
  const inScope = useLoadingScope();
  // The host's own block wins; else the card, where a chat is there to open and the FAQ has a topic
  // (an empty topic is no topic, as the questions request reads it).
  const askTopic = ask === false ? undefined : ask?.topic || topic || entityType;
  const aside =
    asideProp ??
    (ask !== false && askTopic && faqAskCardShown(assistant) ? <FaqAskCard {...ask} topic={askTopic} /> : undefined);
  const url = buildFaqsUrl(entityType, entityId, minResults, apiBaseUrl, topic);
  // Memoized — useSelfFetch re-syncs on [initialData]; a fresh per-render
  // wrapper object would setState-loop under re-rendering parents.
  const initialData = useMemo<FaqsResponse | undefined>(
    () => (initialFaqs ? { faqs: initialFaqs } : undefined),
    [initialFaqs],
  );
  // A loading scope fetches nothing.
  const { data, dataUrl, isLoading, error } = useSelfFetch<FaqsResponse>(inScope ? null : url, { initialData });

  // Only the answer for THIS url: while another topic's questions load, the
  // previous topic's are not this page's. Memoised because the `??` fallback
  // minted a NEW array on every render, which made the memo below re-run
  // every time — i.e. do nothing.
  const held = dataUrl === url ? data?.faqs : undefined;
  const faqs = useMemo(() => held ?? [], [held]);
  // Grouped before the early returns so the hook order stays stable.
  const groups = useMemo(() => (faqs.length > 0 ? groupFaqsBySection(faqs) : []), [faqs]);

  // `heading === null` also makes the category headings <h2> (directly under the page <h1>); otherwise they nest
  // as <h3>.
  const headingNode = faqHeadingNode(heading, showTopic, topic);

  // Degrade silently — never show an error banner or an empty section shell
  // where FAQs would be (host pages and the standalone surface both rely on it).
  if (error) return null;
  // In a loading scope, or while its own request is unanswered, the block is its skeleton.
  if (inScope || (isLoading && faqs.length === 0)) {
    return (
      <FaqSectionSkeleton
        heading={heading}
        topic={topic}
        showTopic={showTopic}
        aside={aside}
        shape={skeletonShape ?? [{ rows: minResults }]}
        navRow={skeletonNav}
        className={className}
        id={id}
      />
    );
  }
  if (faqs.length === 0) return null;

  const schema = emitJsonLd ? buildFaqJsonLdFromFaqs(faqs, jsonLd) : null;

  return (
    <>
      <section id={id} data-faq-topic={topic} className={className ?? SECTION_DEFAULT_CLASS}>
        {!aside && headingNode}
        <GroupedFaqList
          groups={groups}
          categoryHeadingAs={heading === null ? 'h2' : 'h3'}
          heading={aside ? headingNode : undefined}
          aside={aside}
          navDeclared={skeletonNav}
        />
      </section>
      {schema && (
        <script
          type="application/ld+json"
          // serializeJsonLd, NOT raw JSON.stringify — FAQ answers are
          // admin-entered; an embedded "</script>" must not break the tag.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      )}
    </>
  );
}

export interface FaqSectionSkeletonProps extends Pick<
  FaqSectionProps,
  'heading' | 'topic' | 'showTopic' | 'aside' | 'className' | 'id'
> {
  /** The groups drawn, in order. Default one group with no heading, of one screen of rows. */
  shape?: FaqSkeletonShape;
  /** Draw the category nav's row (one line of pills) whatever `sections` is: the host's FAQs are categorised. */
  navRow?: boolean;
}

/**
 * The FAQ block while its questions are read: the heading (the host's node, or "Frequently Asked Questions") and the
 * topic line real, the aside (the ask card, which draws its own loading state) in its place, then the `shape`'s groups:
 * a named one with its heading bar (two or more named ones draw the nav's pills), each its question rows, as bars.
 */
const DEFAULT_SKELETON_SHAPE: FaqSkeletonShape = [{}];

export function FaqSectionSkeleton({
  heading,
  topic,
  showTopic = false,
  aside,
  shape = DEFAULT_SKELETON_SHAPE,
  navRow = false,
  className,
  id,
}: FaqSectionSkeletonProps) {
  const headingNode = faqHeadingNode(heading, showTopic, topic);
  const CategoryHeading = heading === null ? 'h2' : 'h3';
  const groups = shape.length > 0 ? shape : DEFAULT_SKELETON_SHAPE;
  const named = groups.filter(group => group.heading).length;
  const pill = (i: number) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton pills never reorder
    <span key={i} className={cn(CATEGORY_PILL_CLASS, 'shrink-0 border-ods-border bg-ods-card')}>
      <TextLineSkeleton type="inherit" as="span" className="w-24" />
    </span>
  );
  const nav = navRow ? (
    <div className={CATEGORY_NAV_SKELETON_LINE_CLASS} aria-hidden>
      {Array.from({ length: FAQ_NAV_SKELETON_PILLS }, (_, i) => pill(i))}
    </div>
  ) : named > 1 ? (
    <div className={CATEGORY_NAV_CLASS} aria-hidden>
      {Array.from({ length: named }, (_, i) => pill(i))}
    </div>
  ) : undefined;
  const questions = (
    <div className={QUESTIONS_STACK_CLASS}>
      {groups.map((group, index) => {
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton groups never reorder
          <section key={index} className={CATEGORY_SECTION_CLASS} data-loading-item>
            {group.heading && (
              <CategoryHeading className={CATEGORY_HEADING_CLASS} data-loading-optional={navRow ? undefined : true}>
                <TextLineSkeleton type="inherit" as="span" className="w-1/3" />
              </CategoryHeading>
            )}
            <FaqAccordionSkeleton count={Math.max(1, group.rows ?? FAQ_SECTION_SKELETON_QUESTIONS)} />
          </section>
        );
      })}
    </div>
  );
  return (
    <LoadingRegion label="Loading questions">
      <section id={id} data-faq-topic={topic} className={className ?? SECTION_DEFAULT_CLASS}>
        {!aside && headingNode}
        <FaqLayout
          heading={aside ? headingNode : undefined}
          nav={nav}
          navDeclared={navRow}
          questions={questions}
          aside={aside}
        />
      </section>
    </LoadingRegion>
  );
}
