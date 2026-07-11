"use client";

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { EntityIcon } from './icon-display';
import {
  dismissAnnouncement,
  isAnnouncementDismissed,
  clearLegacyAnnouncementCache,
} from '../utils/announcement-storage';
import type { AnnouncementBarProps, AnnouncementResponse } from '../types/announcement';
import { getAppType } from '../utils/app-config';
import { useEndpointsRuntime } from '../contexts/endpoints-runtime-context';
import { useSelfFetch } from '../hooks/use-self-fetch';
import { pickReadableTextColor } from '../utils/color-analysis';

/**
 * Platform announcement bar.
 *
 * Data flow (no polling): the hub SSR-seeds `initialAnnouncement` from the
 * root layout (dismissal cookie already applied server-side → zero layout
 * shift, no flash for dismissed users). Embedded hosts omit the prop and the
 * bar self-fetches via the optional endpoints runtime — no provider → no
 * fetch, silent no-op (cached-free: nothing renders). Freshness is
 * event-driven: `useSelfFetch`'s visibility revalidation re-fetches on tab
 * refocus when the held data is >60s old (matching the server cache TTL by
 * convention); idle tabs make zero requests.
 *
 * Layout: the bar animates its height (grid 0fr↔1fr) for client-side
 * appearance and dismissal, so surrounding content reflows smoothly instead
 * of jumping. The initial expanded state is a pure function of props —
 * SSR-seeded bars render at full height on both server and first client
 * render (hydration-identical), with no entrance animation.
 *
 * Dismissal: cookie is the SSOT (`announcement-storage.ts`); reads happen
 * ONLY in effects (a render-time storage read would desync hydration).
 */
export function AnnouncementBar({
  initialAnnouncement,
  previewMode = false,
  className,
}: AnnouncementBarProps = {}) {
  // Platform for the dismissal cookie/legacy keys (matches the hub's
  // server-side currentPlatform(), both derive from NEXT_PUBLIC_APP_TYPE).
  const platform = getAppType();

  // Optional endpoint runtime: no provider → no URL → fetching disabled.
  const endpoints = useEndpointsRuntime();
  const url = previewMode ? null : endpoints?.announcementsUrl ?? null;

  // MUST be memoized (the hook re-syncs on [initialData] identity — an inline
  // literal per render would setData-loop) and strict-undefined-mapped:
  // `null` (hub: dismissed / no active announcement) still seeds the hook and
  // skips the mount fetch; only an ABSENT prop (embeds) enables self-fetch.
  const initialData = useMemo<AnnouncementResponse | undefined>(
    () => (initialAnnouncement === undefined ? undefined : { announcement: initialAnnouncement }),
    [initialAnnouncement],
  );

  const { data } = useSelfFetch<AnnouncementResponse>(url, {
    initialData,
    revalidateOnVisibleAfterMs: 60_000,
  });
  const announcement = data?.announcement ?? null;

  // Expanded (height) state — initial value is a pure function of props so
  // the SSR HTML and the hydration render agree for every cohort.
  const [expandedState, setExpandedState] = useState<boolean>(() => initialAnnouncement != null);
  // Preview always mirrors the draft directly (effects are disabled there).
  const expanded = previewMode ? announcement != null : expandedState;

  // One-time cleanup of the pre-refactor localStorage announcement cache.
  useEffect(() => {
    if (previewMode) return;
    clearLegacyAnnouncementCache(platform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Visibility reconciliation — runs on the seed and after EVERY completed
  // fetch (keyed on `data` identity, not announcement id, so a refocus
  // revalidation that returns the same announcement still re-checks the
  // dismissal store: this is what keeps a bar dismissed seconds earlier in
  // another tab from resurrecting). Also the legacy-migration point: an
  // LS-only dismissal (no cookie — server couldn't see it) collapses once,
  // animated, and backfills the cookie so the next SSR skips the bar.
  useEffect(() => {
    if (previewMode) return;
    if (!announcement) {
      setExpandedState(false);
      return;
    }
    if (isAnnouncementDismissed(platform, announcement.id)) {
      dismissAnnouncement(platform, announcement.id); // idempotent cookie backfill
      setExpandedState(false);
    } else {
      setExpandedState(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleDismiss = () => {
    if (previewMode || !announcement) return;
    dismissAnnouncement(platform, announcement.id);
    setExpandedState(false);
  };

  const handleCtaClick = () => {
    if (previewMode || !announcement?.cta_url) return;
    announcement.cta_target === '_blank'
      ? window.open(announcement.cta_url, '_blank', 'noopener,noreferrer')
      : (window.location.href = announcement.cta_url);
  };

  // Nothing to show (and nothing to animate around): render nothing. The
  // dismissed/deactivated case keeps the element mounted at 0fr so the
  // collapse animates.
  if (!announcement) return null;

  // Contrast is solved with the ODS THEME system, not color literals: the
  // admin background's tone selects which ODS theme scopes the bar's content
  // (light-toned background needs dark-on-light = the light theme's values;
  // dark-toned needs the dark theme's). `.theme-light` / `.theme-dark` are
  // the design system's own scoping classes (ods-colors.css) and flip every
  // Tier-1 `--ods-*` primitive for descendants.
  const themeScope = pickReadableTextColor(announcement.background_color) === 'dark' ? 'theme-light' : 'theme-dark';

  // Inside the scope, colors reference Tier-1 theme primitives directly
  // (Tier-2 `--color-*` aliases resolve once at :root and do NOT re-resolve
  // in a nested theme scope — verified). `--ods-system-greys-white` is the
  // theme's primary-text primitive; `--ods-system-greys-black-hover/-action`
  // are its quiet hover/active surfaces. Every value comes from the active
  // ODS theme; nothing is hardcoded.
  const barButtonClasses =
    'text-[color:var(--ods-system-greys-white)] hover:bg-[var(--ods-system-greys-black-hover)] active:bg-[var(--ods-system-greys-black-action)]';

  const hasCta = Boolean(announcement.cta_enabled && announcement.cta_url);

  return (
    <div
      role="region"
      aria-label="Announcement"
      aria-hidden={!expanded}
      data-announcement-bar
      className={`relative w-full z-50 grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${className ?? ''}`}
      style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
    >
      {/*
        Bar anatomy follows the announcement-bar industry standard: ONE line of
        text at 13-14px inside a 44px-tall strip (guides converge on 40-60px
        with a single sentence; two stacked 18px rows blew past that), title +
        description merged inline (description hidden on small screens), ONE
        compact CTA on the right, and a ghost-icon dismiss (design-system
        icon-sm: 32px target, >= the 24px WCAG 2.2 SC 2.5.8 AA floor).
      */}
      <div className={`min-h-0 overflow-hidden ${themeScope}`} style={{ backgroundColor: announcement.background_color }}>
        <div className="flex items-center w-full max-w-full min-h-11 text-[color:var(--ods-system-greys-white)]">
          {/* Mobile: Clickable content area, Desktop: Regular content */}
          <div
            className={`flex flex-row gap-2 md:gap-3 items-center pl-4 md:pl-6 py-1.5 flex-1 min-w-0 ${
              hasCta ? 'md:cursor-default cursor-pointer' : ''
            }`}
            onClick={(e) => {
              // Only handle click on mobile (< 768px) and if CTA is enabled
              if (window.innerWidth < 768 && hasCta) {
                e.preventDefault();
                handleCtaClick();
              }
            }}
          >
            {/* ONE unified icon path (shared with the chat): uploaded image URL
                wins, else a library glyph by name (+ props), via <EntityIcon>. */}
            <EntityIcon
              icon={{
                name: announcement.icon_name || 'openframe-logo',
                url: announcement.icon_url,
                props: announcement.icon_props,
              }}
              size={24}
              className="relative shrink-0 w-5 h-5 md:w-6 md:h-6"
            />

            {/* Single-line message: bold title + regular description inline,
                truncating as one unit. Separator is a middot (house rule: no
                en/em dashes in copy). */}
            <p className="font-body flex-1 min-w-0 max-w-full text-[13px] md:text-sm leading-snug truncate mb-0">
              <span className="font-semibold">{announcement.title}</span>
              {announcement.description && (
                <span className="hidden sm:inline opacity-80"> · {announcement.description}</span>
              )}
            </p>

            {/* CTA - the common Button in the bar's quiet treatment: ghost
                surface, computed-foreground text, translucent fg-tint hover
                (barButtonClasses) so nothing renders as a dark slab on the
                admin color. The admin cta_button_* colors are NOT applied:
                they were designed for the legacy bespoke treatment. Hidden
                on mobile, where the whole bar is the tap target. */}
            {hasCta && announcement.cta_text && (
              <div className="hidden md:flex flex-shrink-0 ml-1">
                <Button
                  onClick={handleCtaClick}
                  variant="transparent"
                  size="small"
                  className={barButtonClasses}
                  leftIcon={
                    announcement.cta_show_icon && announcement.cta_icon_name
                      ? (
                          <EntityIcon
                            icon={{ name: announcement.cta_icon_name, props: announcement.cta_icon_props }}
                            size={14}
                            className="w-3.5 h-3.5"
                          />
                        )
                      : undefined
                  }
                >
                  {announcement.cta_text}
                </Button>
              </div>
            )}
          </div>

          {/* Dismiss - the common Button in its ghost-icon treatment
              (size="icon-sm": 32px target, >= the 24px WCAG 2.5.8 AA floor,
              16px glyph) with the bar's quiet tint hover. Inert in
              previewMode. */}
          <div className="flex-shrink-0 mr-1 md:mr-3">
            <Button
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering the mobile CTA click
                handleDismiss();
              }}
              variant="transparent"
              size="icon-sm"
              className={barButtonClasses}
              aria-label="Dismiss announcement"
              type="button"
              tabIndex={expanded ? 0 : -1}
            >
              <X strokeWidth={2} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
