'use client'

/* ============================================================================
 * ⛔️ FROZEN — DO NOT MODIFY (AI agents & contributors, read this first)
 * ----------------------------------------------------------------------------
 * `TitleBlock` is the FINALIZED title/subtitle/back-button/actions chrome used
 * by `PageLayout`. It is a locked, complete component — treat it as read-only.
 *
 * Do NOT: change the markup/CSS, alter the title typography (`text-h2`) or
 * subtitle (`text-h6`), change the image/title 2-column layout, re-route this
 * through a `PageHeader`/`PageWithHeader` primitive, or add/rename props. Do
 * NOT "unify"/"refactor"/"simplify" it or restyle it to match another surface.
 *
 * Why this rule exists (the incident it prevents): a refactor once rewrote
 * this to delegate to a new `PageHeader` (title bumped to `text-h1`, new
 * subtitle styling) to "unify" page chrome — it silently changed every page
 * using `PageLayout` and had to be fully reverted. This code IS that reverted,
 * correct baseline.
 *
 * Downstream consumers (OpenFrame pages, `DevSectionPage`, `DocViewer`, and the
 * multi-platform hub via its local `PageWithHeader`) depend on the EXACT
 * current output. If a new design needs different chrome, build a SEPARATE new
 * component — never mutate this one. If an edit here seems unavoidable, STOP
 * and get explicit human sign-off first.
 *
 * SANCTIONED EXCEPTION (2026-06, explicit human sign-off): the OPTIONAL
 * `titleSize` prop. It defaults to `'h2'` — i.e. the frozen baseline above is
 * unchanged for EVERY existing caller. A caller may pass `titleSize="h1"` to
 * opt the title typography up to `text-h1` (used by the unified Help Center
 * pages). This is additive and default-preserving; do NOT change the default or
 * touch anything else here.
 *
 * SANCTIONED EXCEPTION (2026-06, explicit human sign-off): the OPTIONAL
 * `titleAdornment` and `loading` props. `titleAdornment` renders a node inline
 * after the title (e.g. a status `Tag`). `loading` swaps ONLY the title/subtitle
 * TEXT for line-box-accurate skeleton bars (the surrounding `h1`/`p` and their
 * typography are untouched, so a loading header is pixel-identical in height to
 * the loaded one — used by page skeletons that render through `PageLayout`).
 * Both are additive + default-preserving: omit them and every existing caller is
 * byte-identical. Do NOT change defaults or touch anything else here.
 *
 * SANCTIONED EXCEPTION (2026-07, explicit human sign-off): the OPTIONAL
 * `subtitleRow` prop. Defaults to `'when-set'` — the subtitle row keeps
 * rendering only when `subtitle` is truthy, so every existing caller is
 * byte-identical. The other two values decide how a page trades a header that
 * never moves against a header that never shows an empty line; see the prop's
 * own doc for which to pick. Additive + default-preserving; do NOT change the
 * default.
 *
 * SANCTIONED EXCEPTION (2026-07, explicit human sign-off): the OPTIONAL
 * `titleWrap` prop. Defaults to `false` — the frozen single-line `truncate`
 * baseline is unchanged for every existing caller. Content DETAIL pages (whose
 * h1 is CMS data of arbitrary length — releases, legal docs, FAQ docs, dev
 * sections) pass `titleWrap` to let the title wrap onto multiple lines instead
 * of being ellipsis-clipped. Additive + default-preserving; do NOT change the
 * default or touch anything else here.
 *
 * SANCTIONED EXCEPTION (2026-07, explicit human sign-off — ClickUp 86ahd6uy5):
 * responsive action layout on md+. This one intentionally CHANGES the baseline
 * for every caller, per the approved design (Figma open-design-system node
 * 2200-7452): instead of tablet always stacking actions below the title
 * (`md:flex-col`) and desktop always keeping one row (long titles clipped),
 * md+ is a single `flex-wrap` row — actions stay inline with a short title on
 * BOTH tablet and desktop, and wrap to a second row only when the title is
 * long enough to overflow. The title column is `md:flex-none md:max-w-full`
 * so its natural width drives the wrap while `truncate` still clamps a title
 * that alone exceeds the container. The mobile (base) layout is untouched.
 * This is the new frozen baseline; do NOT re-introduce breakpoint stacking.
 *
 * SANCTIONED EXCEPTION (2026-07, explicit human sign-off): overflow tooltips on
 * the title and subtitle. This one CHANGES the baseline for every caller: the
 * native `title=""` attribute on both is replaced by the ODS `FloatingTooltip`,
 * armed only when the text is genuinely clipped (`useIsTruncated`). Both stay
 * single-line — that is the design, and the tooltip is what makes a clipped
 * title readable instead of merely pretty. Nothing is lost for assistive tech:
 * `text-overflow: ellipsis` never hid the text from the accessibility tree, so
 * the full string was always exposed; the attribute only ever served a mouse.
 * The wrapper `div` the tooltip needs goes OUTSIDE the `h1`/`p` — never inside:
 * a `div` inside a `p` is auto-closed by the HTML parser, which would split the
 * subtitle paragraph and desync hydration. The `titleWrap` branch is untouched
 * (wrapped text never clips, so it never needs a tooltip).
 * ========================================================================== */

import React from 'react'
import { useIsTruncated } from '../../hooks/ui/use-is-truncated'
import { cn } from '../../utils/cn'
import type { ActionsMenuGroup } from '../ui/actions-menu'
import { EntityImage } from '../ui/entity-image'
import { FloatingTooltip } from '../ui/floating-tooltip'
import { PageActions, type PageActionButton } from '../ui/page-actions'
import { BackButton } from './back-button'

/**
 * Minimum height of the title block's content column, matched to the action
 * button height: the icon button on mobile (`h-11` → 44px) and the default
 * button on desktop (`md:h-12` → 48px). Applied to the inner title column (which
 * has no padding) rather than the root — the root's `pt`/`mb` are box-sizing
 * border-box and would otherwise absorb the floor. Keeps the header a consistent
 * height across pages whether or not they render action buttons, so the content
 * below starts at the same baseline. Exported so other page chrome can reuse it.
 */
export const TITLE_BLOCK_MIN_HEIGHT = 'min-h-11 md:min-h-12'

export interface TitleBlockProps {
  title?: string
  subtitle?: string
  image?: { src: string; alt?: string }
  backButton?: { label?: string; onClick: () => void }
  actions?: PageActionButton[]
  actionsVariant?: 'icon-buttons' | 'primary-buttons' | 'menu-primary'
  menuActions?: ActionsMenuGroup[]
  /** Desktop-only slot (e.g. a `TabSelector`) rendered with the actions. Hidden on mobile. */
  selector?: React.ReactNode
  /**
   * Visual variant.
   * - `plain` (default): transparent background, no border.
   * - `card`: card background, border, and padding on mobile only — collapses to plain on md+.
   */
  variant?: 'plain' | 'card'
  className?: string
  /** Title typography size. Default `'h2'` (the frozen baseline). Pass `'h1'` to
   *  opt the title up to `text-h1` (the unified Help Center pages). Subtitle stays
   *  `text-h6` either way. */
  titleSize?: 'h1' | 'h2'
  /** Optional node rendered inline, immediately after the title (e.g. a status `Tag`).
   *  Additive + default-preserving: omit it and every existing caller is byte-identical. */
  titleAdornment?: React.ReactNode
  /** When true, the title/subtitle TEXT is replaced by line-box-accurate skeleton bars
   *  (typography + surrounding markup unchanged, so header height is identical to loaded).
   *  Additive + default-preserving: omit it and every existing caller is byte-identical. */
  loading?: boolean
  /**
   * Render the ACTIONS as placeholders too. Separate from `loading` on purpose:
   * a page whose action set is already final (it depends on the route, not on
   * the record) keeps showing its real buttons while the title loads.
   */
  loadingActions?: boolean
  /**
   * When the subtitle row occupies the layout. The subtitle is often optional
   * RECORD data — unknown while loading, sometimes absent afterwards — and there
   * is no setting that both fills the loading header and never leaves a blank
   * line, so the caller picks which one matters.
   *
   * - `'when-set'` (default) — only when `subtitle` has text.
   * - `'while-loading'` — also during `loading`, as a skeleton bar. The header
   *   looks complete while it loads, and the row collapses if the record turns
   *   out to have no subtitle (so that case settles one line shorter).
   * - `'always'` — the row never collapses; an empty subtitle holds its line
   *   with an invisible spacer. The header cannot change height. Use it when the
   *   loaded page ALWAYS has a subtitle — typically a standalone skeleton
   *   component matching a page whose subtitle is guaranteed.
   */
  subtitleRow?: 'when-set' | 'while-loading' | 'always'
  /** When true, a long title WRAPS onto multiple lines instead of the frozen single-line
   *  ellipsis clamp. For content detail pages whose h1 is CMS data of arbitrary length.
   *  Additive + default-preserving: omit it and every existing caller is byte-identical. */
  titleWrap?: boolean
}

/**
 * Inline text skeleton — used only in `loading` mode, placed directly inside the real
 * `h1`/`p`. It is a single `inline-block` bar whose height is intentionally SHORTER than the
 * typography line-height, and it uses the default baseline alignment. That way the element's
 * own line-box STRUT (text-h2 → 40px, text-h6 → 20px) sets the height exactly as it would for
 * real text — the bar fits within the ascent and never inflates the line. So a loading header
 * is pixel-identical in height to the loaded one. Phrasing-valid (`span` only).
 */
function TitleTextSkeleton({ widthClass, heightClass }: { widthClass: string; heightClass: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block max-w-full rounded-md bg-ods-border animate-pulse', widthClass, heightClass)}
    />
  )
}

/**
 * Bar geometry per title size, following the ODS type scale across breakpoints
 * (`md` = 800px, `lg` = 1280px here — the SAME widths the typography tokens
 * switch at, so bar and text step together).
 *
 * `h2` needs no `lg` step because `text-h2` has none: it is 24/32 on mobile and
 * 32/40 from tablet up. `text-h1` scales at both breakpoints (40 → 48 → 56), so
 * its bar does too — reusing the h2 bar there would leave a stamp-sized smudge
 * inside a 64px line. Heights stay well under the line box's ascent on purpose;
 * see `TitleTextSkeleton` for why that is what keeps the header height honest.
 */
const TITLE_SKELETON_SIZE = {
  h1: { width: 'w-56 md:w-80 lg:w-96', height: 'h-7 md:h-8 lg:h-9' },
  h2: { width: 'w-48 md:w-72', height: 'h-4 md:h-6' },
} as const

export function TitleBlock({
  title,
  subtitle,
  image,
  backButton,
  actions,
  actionsVariant = 'icon-buttons',
  menuActions,
  selector,
  variant = 'plain',
  className,
  titleSize = 'h2',
  titleAdornment,
  loading,
  loadingActions,
  subtitleRow = 'when-set',
  titleWrap = false,
}: TitleBlockProps) {
  const hasSubtitleRow =
    !!subtitle || subtitleRow === 'always' || (subtitleRow === 'while-loading' && !!loading)
  const hasActions = actions && actions.length > 0
  const hasMenuActions = !!menuActions && menuActions.some(g => g.items.length > 0)
  const titleClass = titleSize === 'h1' ? 'text-h1' : 'text-h2'
  // Frozen baseline is the single-line `truncate`; `titleWrap` swaps it for
  // multi-line wrapping (break-words guards pathological unbroken tokens).
  const titleOverflowClass = titleWrap ? 'break-words' : 'truncate'
  const skeletonSize = TITLE_SKELETON_SIZE[titleSize]

  // Exactly one title element renders per pass, so one ref covers every branch.
  // The tooltip arms itself only on real clipping — repeating a fully visible
  // title back to the user is noise, and `titleWrap`/loading never clip at all.
  const { ref: titleRef, isTruncated: titleTruncated } = useIsTruncated<HTMLHeadingElement>(loading ? null : title)
  const { ref: subtitleRef, isTruncated: subtitleTruncated } = useIsTruncated<HTMLParagraphElement>(
    loading ? null : subtitle,
  )
  const titleNode = loading ? <TitleTextSkeleton widthClass={skeletonSize.width} heightClass={skeletonSize.height} /> : title

  return (
    <div
      className={cn(
        'flex items-end justify-between gap-[var(--spacing-system-m)]',
        // md+: one wrapping row — actions stay inline with a short title and
        // wrap to a second row only when the title overflows (ClickUp 86ahd6uy5).
        'md:flex-wrap md:content-end',
        'pt-[var(--spacing-system-l)]',
        variant === 'card'
          ? cn(
              'bg-ods-card border-b border-ods-border',
              'px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]',
              'md:bg-transparent md:border-b-0',
              'md:px-0 md:pb-0',
              'md:mb-[var(--spacing-system-l)]',
            )
          : 'mb-[var(--spacing-system-l)]',
        className,
      )}
    >
      {/* md+: `flex-none` sizes the column to its content so a long title (capped
          at `max-w-full`, still truncating) pushes the actions onto the next
          wrap line; a short title leaves them inline. Base (mobile) keeps flex-1. */}
      <div className={cn('flex flex-col justify-center gap-[var(--spacing-system-xs)] flex-1 min-w-0 md:flex-none md:max-w-full', TITLE_BLOCK_MIN_HEIGHT)}>
        {backButton && (
          <BackButton
            onClick={backButton.onClick}
            label={backButton.label}
            className="hidden md:inline-flex"
          />
        )}
        {(image || hasSubtitleRow || loading) ? (
          <div className="flex items-center gap-[var(--spacing-system-m)] min-w-0 w-full">
            {image && (
              <EntityImage
                src={image.src}
                alt={image.alt}
                fallbackText={image.alt || title}
              />
            )}
            <div className="flex flex-col justify-center min-w-0 flex-1">
              {(loading || title) && (
                titleAdornment ? (
                  <div className="flex items-center gap-[var(--spacing-system-m)] min-w-0 w-full">
                    {/* `min-w-0` moves onto the tooltip's wrapper: the wrapper is
                        now the flex item, and without it the row refuses to
                        shrink and pushes the adornment out. */}
                    <FloatingTooltip content={title} side="bottom" disabled={!titleTruncated} triggerClassName="min-w-0">
                      <h1 ref={titleRef} className={cn(titleClass, 'text-ods-text-primary min-w-0', titleOverflowClass)}>{titleNode}</h1>
                    </FloatingTooltip>
                    <span className="shrink-0">{titleAdornment}</span>
                  </div>
                ) : (
                  <FloatingTooltip content={title} side="bottom" disabled={!titleTruncated}>
                    <h1 ref={titleRef} className={cn(titleClass, 'text-ods-text-primary', titleOverflowClass)}>{titleNode}</h1>
                  </FloatingTooltip>
                )
              )}
              {hasSubtitleRow && (
                /* The NBSP is a pure spacer, reached only in `'always'` mode: an
                   empty `p` collapses to zero height (its only content would be
                   collapsible whitespace), which is exactly the shift that mode
                   exists to prevent. Hidden from AT — it carries no meaning. */
                <FloatingTooltip content={subtitle} side="bottom" disabled={!subtitleTruncated}>
                  <p
                    ref={subtitleRef}
                    className="text-h6 text-ods-text-secondary truncate"
                    aria-hidden={!loading && !subtitle ? true : undefined}
                  >{loading ? <TitleTextSkeleton widthClass="w-28 md:w-36" heightClass="h-2.5 md:h-3" /> : (subtitle || '\u00A0')}</p>
                </FloatingTooltip>
              )}
            </div>
          </div>
        ) : (
          title && (
            titleAdornment ? (
              <div className="flex items-center gap-[var(--spacing-system-m)] min-w-0 w-full">
                <FloatingTooltip content={title} side="bottom" disabled={!titleTruncated} triggerClassName="min-w-0">
                  <h1 ref={titleRef} className={cn(titleClass, 'text-ods-text-primary min-w-0', titleOverflowClass)}>{title}</h1>
                </FloatingTooltip>
                <span className="shrink-0">{titleAdornment}</span>
              </div>
            ) : (
              /* This branch never had the single-line clamp, so text already
                 wraps; `titleWrap` only adds break-words for pathological
                 unbroken tokens. No class change when the prop is unset —
                 the frozen baseline stays byte-identical. */
              <h1 className={cn(titleClass, 'text-ods-text-primary', titleWrap && 'break-words')}>{title}</h1>
            )
          )
        )}
      </div>

      {/* `loadingActions` opens this gate on its own: the case the flag exists for
          is a page that does not YET know its action set, which is exactly the
          page that passes `actions={[]}` — gating on `hasActions` alone would
          render nothing and then pop the real buttons in. */}
      {(hasActions || hasMenuActions || selector || loadingActions) && (
        <div className="flex gap-2 items-center shrink-0">
          <PageActions
            variant={actionsVariant}
            actions={actions ?? []}
            menuActions={menuActions}
            selector={selector}
            loading={loadingActions}
          />
        </div>
      )}
    </div>
  )
}

export default TitleBlock
