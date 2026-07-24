'use client';

import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEndpointsRuntime } from '../contexts/endpoints-runtime-context';
import { useSelfFetch } from '../hooks/use-self-fetch';
import type { Announcement, AnnouncementBarProps, AnnouncementResponse } from '../types/announcement';
import { ANNOUNCEMENT_CTA_DEFAULTS } from '../types/announcement';
import {
  clearLegacyAnnouncementCache,
  dismissAnnouncement,
  isAnnouncementDismissed,
} from '../utils/announcement-storage';
import { getAppType } from '../utils/app-config';
import { pickReadableTextColor } from '../utils/color-analysis';
import { EntityIcon } from './icon-display';
import { AnnouncementBarView } from './ui/announcement-bar-view';
import { Button } from './ui/button';

/**
 * Platform announcement bar — DUAL MODE, works with or without SSR.
 *
 * SSR mode (Next hosts, e.g. the hub): the server resolves the announcement
 * and the dismissal cookie, then passes `initialAnnouncement` (nullable).
 * The bar renders in the first HTML byte (zero layout shift, no flash for
 * dismissed users) and skips the mount fetch.
 *
 * Client-only mode (bare React apps without SSR: Vite/CRA embeds — see
 * react-embedding-example): omit `initialAnnouncement` and mount the bar
 * PROP-LESS inside an EndpointsRuntime provider; it self-fetches from the
 * provider's `announcementsUrl` (a fixed suffix under the embedder's one
 * content base). No provider → renders nothing, never fetches (silent
 * no-op). Appearance animates in (grid 0fr→1fr) so there is no hard layout
 * jump. Deliberately NO per-component URL or platform knobs: the embedder
 * is platform-agnostic — each server returns ITS OWN announcement via
 * currentPlatform(); the platform is never sent as a parameter.
 *
 * Both modes: freshness is event-driven, no polling — `useSelfFetch`'s
 * visibility revalidation re-fetches on tab refocus when the held data is
 * >60s old (matching the server cache TTL by convention); idle tabs make
 * zero requests. Dismissal cookie is the SSOT (`announcement-storage.ts`);
 * storage reads happen ONLY in effects (a render-time read would desync
 * hydration in SSR mode).
 */
export function AnnouncementBar({ initialAnnouncement, previewMode = false, className }: AnnouncementBarProps = {}) {
  // Namespace for the dismissal cookie/legacy keys. Next hosts inline
  // NEXT_PUBLIC_APP_TYPE (matching the server's currentPlatform(), which the
  // hub layout uses for the SSR cookie read); platform-agnostic embeds get
  // the fallback — fine, cookies are domain-scoped and an embed domain
  // serves one platform's announcements.
  const platform = getAppType();

  // Optional endpoint runtime: no provider → no URL → fetching disabled.
  const endpoints = useEndpointsRuntime();
  const url = previewMode ? null : (endpoints?.announcementsUrl ?? null);

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

  // Hold the last non-null announcement so DEACTIVATION (a revalidation that
  // returns null) collapses with the same 1fr->0fr animation as dismissal
  // instead of unmounting in place (a hard 44px jump).
  const lastAnnouncementRef = useRef<Announcement | null>(initialAnnouncement ?? null);
  useEffect(() => {
    if (announcement) lastAnnouncementRef.current = announcement;
  }, [announcement]);
  const displayAnnouncement = announcement ?? lastAnnouncementRef.current;

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
    // Release focus BEFORE the wrapper goes aria-hidden — a focused descendant
    // inside an aria-hidden subtree strands screen-reader focus (and Chrome
    // refuses to apply the attribute).
    (document.activeElement as HTMLElement | null)?.blur?.();
    setExpandedState(false);
  };

  const handleCtaClick = () => {
    if (previewMode || !announcement?.cta_url) return;
    // Scheme guard: cta_url is admin-entered data — only http(s) (absolute or
    // relative) may navigate. A `javascript:` value would otherwise execute
    // via location.href / window.open (stored XSS).
    let safeUrl: string;
    try {
      // Resolve against the CURRENT page (not the origin) so path-relative and
      // fragment CTAs keep their pre-guard semantics.
      const parsed = new URL(announcement.cta_url, window.location.href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
      safeUrl = parsed.href;
    } catch {
      return;
    }
    announcement.cta_target === '_blank'
      ? window.open(safeUrl, '_blank', 'noopener,noreferrer')
      : (window.location.href = safeUrl);
  };

  // Never had anything to show: render nothing. Dismissal AND deactivation
  // keep the element mounted (displayAnnouncement holds the last content) at
  // 0fr so the collapse animates.
  if (!displayAnnouncement) return null;

  // Contrast is solved with the ODS THEME system, not color literals: the
  // admin background's tone selects which ODS theme scopes the bar's content
  // (light-toned background needs dark-on-light = the light theme's values;
  // dark-toned needs the dark theme's). `.theme-light` / `.theme-dark` are
  // the design system's own scoping classes (ods-colors.css) and flip every
  // Tier-1 `--ods-*` primitive for descendants.
  const themeScope =
    pickReadableTextColor(displayAnnouncement.background_color) === 'dark' ? 'theme-light' : 'theme-dark';

  // Inside the scope, colors reference Tier-2 semantic aliases. Aliases
  // declared only at :root would NOT re-resolve in a nested theme scope
  // (they compute at :root), so ods-colors.css re-anchors these three inside
  // `.theme-light` / `.theme-dark` specifically for theme islands like this
  // bar. Every value comes from the active ODS theme; nothing is hardcoded.
  const barButtonClasses =
    'text-[color:var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] active:bg-[var(--color-bg-active)]';

  const hasCta = Boolean(
    displayAnnouncement.cta_enabled && displayAnnouncement.cta_url && displayAnnouncement.cta_text,
  );

  return (
    <div
      role="region"
      aria-label="Announcement"
      aria-hidden={!expanded}
      // The marker means "I am the PAGE-CHROME bar" — `useHeaderHeight` sums
      // the first match with the header to offset fixed panels (e.g. the
      // sliding admin sidebar). Admin PREVIEW instances must NOT carry it, or
      // a preview card inflates that offset (phantom gap above the drawer).
      {...(previewMode ? {} : { 'data-announcement-bar': true })}
      className={`relative w-full grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${previewMode ? '' : 'z-50'} ${className ?? ''}`}
      style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
    >
      {/*
        Markup is the shared pure view (AnnouncementBarView), which carries the
        bar's anatomy: ONE line of text inside a 44px strip, ONE compact CTA on
        the right (hidden below `md`, where the content row is the tap target),
        and a ghost-icon dismiss. Surface + content treatment stay here.
      */}
      <div
        className={`min-h-0 overflow-hidden ${themeScope}`}
        style={{ backgroundColor: displayAnnouncement.background_color }}
      >
        <AnnouncementBarView
          className="text-[color:var(--color-text-primary)]"
          contentClassName={hasCta ? 'cursor-pointer md:cursor-default' : undefined}
          onContentClick={hasCta ? handleCtaClick : undefined}
          startAdornment={
            /* ONE unified icon path (shared with the chat): uploaded image URL
               wins, else a library glyph by name (+ props), via <EntityIcon>. */
            <EntityIcon
              icon={{
                name: displayAnnouncement.icon_name || 'openframe-logo',
                url: displayAnnouncement.icon_url,
                props: displayAnnouncement.icon_props,
              }}
              size={24}
              // 20px below `md`, 24px from `md` up. `!` is required: logo
              // glyphs (LogoOpenframeIcon / sizedLogo in icon-library) drive
              // their size via an inline style, which a plain class loses to.
              // Not `--icon-size-icon-size` — that token is 16/24 and would
              // shrink the mobile glyph.
              className="relative !size-5 shrink-0 md:!size-6"
            />
          }
          title={
            /* Single-line message: bold title + regular description inline,
               truncating as one unit, at the strip's caption scale (`text-h6`
               = 13/14px — the same treatment string titles get from the view).
               Separator is a middot (house rule: no en/em dashes in copy). */
            <p className="min-w-0 max-w-full text-h6 truncate mb-0">
              <span className="font-[number:var(--font-weight-semibold)]">{displayAnnouncement.title}</span>
              {displayAnnouncement.description && (
                <span className="hidden sm:inline opacity-80"> · {displayAnnouncement.description}</span>
              )}
            </p>
          }
          actionBlock={
            /* CTA - the common Button carrying the ADMIN-CONFIGURED colors
               (cta_button_background_color / cta_button_text_color are an
               admin FEATURE, defaults from ANNOUNCEMENT_CTA_DEFAULTS —
               announcement colors are data, not token surfaces). Inline
               styles win over the variant's hover classes on every state,
               so hover feedback is opacity (the bar's original treatment);
               nothing can render dark-on-dark. The view CSS-hides it below
               `md`, where the whole content row is the tap target — this
               Button stays the keyboard/AT path (known tradeoff).

               Geometry + type come from the design system's size="compact"
               (24px caption-scale pill for slim strips — rationale documented
               on the variant in button.tsx). */
            hasCta && displayAnnouncement.cta_text ? (
              <Button
                onClick={handleCtaClick}
                variant="outline"
                size="compact"
                className="transition-opacity hover:opacity-90"
                style={{
                  backgroundColor:
                    displayAnnouncement.cta_button_background_color || ANNOUNCEMENT_CTA_DEFAULTS.background,
                  color: displayAnnouncement.cta_button_text_color || ANNOUNCEMENT_CTA_DEFAULTS.text,
                  borderColor: displayAnnouncement.cta_button_background_color || ANNOUNCEMENT_CTA_DEFAULTS.background,
                }}
                tabIndex={expanded ? 0 : -1}
                leftIcon={
                  displayAnnouncement.cta_show_icon && displayAnnouncement.cta_icon_name ? (
                    <EntityIcon
                      icon={{ name: displayAnnouncement.cta_icon_name, props: displayAnnouncement.cta_icon_props }}
                      size={14}
                      className="w-3.5 h-3.5"
                    />
                  ) : undefined
                }
              >
                {displayAnnouncement.cta_text}
              </Button>
            ) : undefined
          }
          endAdornment={
            /* Dismiss - the common Button in its ghost-icon treatment
               (size="icon-sm": 32px target, >= the 24px WCAG 2.5.8 AA floor,
               16px glyph) with the bar's quiet tint hover. Inert in
               previewMode. */
            <Button
              onClick={handleDismiss}
              variant="transparent"
              size="icon-sm"
              className={barButtonClasses}
              aria-label="Dismiss announcement"
              type="button"
              tabIndex={expanded ? 0 : -1}
            >
              <X strokeWidth={2} />
            </Button>
          }
        />
      </div>
    </div>
  );
}
