'use client'

import React from 'react'
import { useRouter } from '../../embed-shims/next-navigation'
import { PageShell } from './article-detail-layout'
import { PageLayout } from './page-layout'
import { PageHeader, type PageHeaderProps } from './page-header'

/**
 * `<PageWithHeader>` — the canonical 4-layer unified-chrome wrapper that
 * every public lib/hub page now uses (Knowledge Hub, Roadmap, FAQs,
 * Authors, Blog, Vendors, Case Studies, Interviews, Investor Updates,
 * /webinars-/podcasts-/events, hub admin-but-public pages, …).
 *
 * Renders the same JSX tree every consumer was hand-rolling individually
 * before this helper landed:
 *
 *   PageShell                         ← bg-ods-bg, min-h-screen, max-w-[1920px],
 *                                       page-shell-px/pt/pb gutters
 *     PageLayout backButton           ← TitleBlock → PageHeader #1 (back-btn row
 *                                       only, pt-l + mb-l)
 *       div.w-full.flex-col.gap-10    ← matches DevSectionView's hero container
 *         PageHeader title/subtitle   ← PageHeader #2 (noTopPadding +
 *           titleIcon accentDot         noBottomMargin so PageLayout's gap-l owns
 *           noTopPadding                the spacing between #1 and #2)
 *           noBottomMargin
 *         children                    ← page-specific body (search, lists, forms)
 *
 * Why this exists: 15+ pages copy-pasted the EXACT same nesting + the
 * EXACT same `noTopPadding + noBottomMargin + accentDot` triplet on the
 * inner `<PageHeader>`. Forgetting one of those flags collapsed the gap
 * to ~8px (the FAQs-vs-Onboarding-Guides bug). Centralizing the chain
 * here makes the spacing invariant compiler-enforced — consumers can't
 * pick the wrong combination.
 *
 * **Back button is config-driven by default.** Consumers don't have to
 * thread `useRouter()` + `() => router.push('/')` themselves anymore —
 * the helper supplies a sane default (`{ label: 'Back to home', href: '/' }`).
 * Hosts whose `/` lives elsewhere should pass their own `href`. Pass
 * `backButton={false}` to suppress entirely (the lib's own
 * `<DocsHubPage>` does this on the platform-home docs landing).
 */
export interface PageWithHeaderProps {
  /** Title — passed straight to inner `<PageHeader>`. */
  title?: string
  /** Inline icon rendered before the title (lucide / SVG node). Wrap with
   *  `SECTION_HERO_ICON_CLASS` at the call site, or use the lib's
   *  `<PageHeader>`'s `titleIcon` ReactNode signature directly. */
  titleIcon?: PageHeaderProps['titleIcon']
  /** Subtitle (1-2 lines, auto-clamped to 2 + min-h-[56px]). */
  subtitle?: string
  /** Render yellow accent dot after the title (default true — matches every
   *  unified surface). Pass `false` to opt out. */
  accentDot?: boolean
  /** Back-button config. Defaults to `{ label: 'Back to home', href: '/' }`.
   *  Pass `false` to hide entirely (platform-home docs landings). */
  backButton?: { label?: string; href?: string } | false
  /** Optional image (entity-image-style — onboarding guides etc.). */
  image?: PageHeaderProps['image']
  /** Optional actions slot (right side of header). */
  actions?: React.ReactNode
  /** Page body — search bars, lists, forms, sections. Rendered INSIDE the
   *  gap-10 flex column so it shares gutters + vertical rhythm with the
   *  header. */
  children: React.ReactNode
  /** Extra class applied to the gap-10 content wrapper. */
  contentClassName?: string
}

export function PageWithHeader({
  title,
  titleIcon,
  subtitle,
  accentDot = true,
  backButton,
  image,
  actions,
  children,
  contentClassName,
}: PageWithHeaderProps) {
  const router = useRouter()

  const backCfg =
    backButton === false
      ? undefined
      : {
          label: backButton?.label ?? 'Back to home',
          onClick: () => router.push(backButton?.href ?? '/'),
        }

  return (
    <PageShell>
      <PageLayout backButton={backCfg}>
        <div className={`w-full flex flex-col gap-10${contentClassName ? ` ${contentClassName}` : ''}`}>
          <PageHeader
            title={title}
            titleIcon={titleIcon}
            subtitle={subtitle}
            accentDot={accentDot}
            image={image}
            actions={actions}
            noTopPadding
            noBottomMargin
          />
          {children}
        </div>
      </PageLayout>
    </PageShell>
  )
}
