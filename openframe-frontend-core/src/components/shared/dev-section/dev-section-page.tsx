'use client';

/**
 * DevSectionPage — full-page wrapper for a dev-center section
 * (`/roadmap`, `/bug-fixes-and-enhancements`, `/releases`).
 *
 * Mounts the lib's canonical `PageLayout` directly (no in-app wrapper)
 * so the back-button affordance stays in lockstep with whatever the
 * design system ships — any future lib change to BackButton / TitleBlock
 * propagates automatically.
 *
 * Composition: `PageShell` → `PageLayout` (back-to-home wired) →
 * `DevSectionView` (icon hero + search + filter pills) → list body.
 *
 * Adding a new section is one entry in `OPENFRAME_DEV_SECTIONS` plus a
 * single-line page file mounting this factory with the new key.
 */

import type { ReactNode } from 'react';
import { useRouter } from '../../../embed-shims/next-navigation';
import { PageShell, PageLayout, type PageActionButton } from '../../ui';
import { DevSectionView } from './dev-section-view';
import {
  OPENFRAME_DEV_SECTIONS,
  type OpenframeDevSectionKey,
} from '../../../utils/dev-sections/openframe-dev-sections';

export interface DevSectionPageProps {
  sectionKey: OpenframeDevSectionKey;
  /** The page-specific list body (e.g. `<RoadmapList />`). */
  children: ReactNode;
  /** Optional slot rendered BETWEEN the hero and search/filter — see
   *  `DevSectionView.preControls`. Used by surfaces that want an entry
   *  action (e.g. Help Center's "Open a new ticket" form) above the
   *  controls instead of below them. */
  preControls?: ReactNode;
  /** Header-row action buttons (title on the left, buttons on the right),
   *  forwarded to `PageLayout.actions` — e.g. Help Center's "Open Support
   *  Ticket" CTA. */
  actions?: PageActionButton[];
  /** Rendering style for `actions`, forwarded verbatim to `PageLayout`
   *  (which owns the default when unset). Pass explicitly at the call site. */
  actionsVariant?: 'icon-buttons' | 'primary-buttons' | 'menu-primary';
  /** Back-button config — same shape as `LegalDocumentPage` /
   *  `ReleaseDetailPage`. Pass `false` to hide entirely. Default
   *  `{ label: 'Back to home', href: '/' }` — embedders whose "home" isn't `/`
   *  should override `href`, or pass `false` if the embed has no home page. */
  backButton?: { label?: string; href?: string } | false;
  /** Override the hero title. Defaults to the (OpenFrame-specific) copy in
   *  `OPENFRAME_DEV_SECTIONS[sectionKey].hero.title`. Set this to brand the
   *  section for a non-OpenFrame embed. */
  title?: string;
  /** Override the hero subtitle/description. Defaults to
   *  `OPENFRAME_DEV_SECTIONS[sectionKey].hero.description`. */
  subtitle?: string;
  /** Render the standalone `<PageShell>` (own `<main>` + bg + max-width). Default
   *  `true` — the contract for marketing/hub surfaces with no app shell. Pass
   *  `false` when the host layout already provides the page container (e.g.
   *  openframe-frontend's `AppLayout` `<main>`): then only the
   *  `page-shell-content` padding box is rendered, avoiding a nested `<main>`. */
  shell?: boolean;
  /** Forwarded to `DevSectionView.showControls` — pass `false` to hide the
   *  search + filter row (e.g. Help Center before the customer has any
   *  tickets). Default `true`. */
  showControls?: boolean;
}

export function DevSectionPage({
  sectionKey,
  children,
  preControls,
  actions,
  actionsVariant,
  backButton,
  title,
  subtitle,
  shell = true,
  showControls,
}: DevSectionPageProps) {
  const router = useRouter();
  const section = OPENFRAME_DEV_SECTIONS[sectionKey];

  // Back-button config — mirrors LegalDocumentPage / ReleaseDetailPage.
  // Default: { label: 'Back to home', href: '/' }. Pass `false` to hide.
  // After `backButton &&` narrowing, inner type is `{ label?, href? } |
  // undefined`; don't re-compare to `false` (TS2367).
  const backCfg =
    backButton === false
      ? undefined
      : {
          label: (backButton ? backButton.label : undefined) ?? 'Back to home',
          onClick: () => router.push((backButton ? backButton.href : undefined) ?? '/'),
        };

  const inner = (
    // Unified header: title/description route through the canonical (frozen)
    // `PageLayout` `TitleBlock` (text-h2) — same as FAQ / Legal / detail pages —
    // so every help-center surface shares one header. `DevSectionView` then
    // renders ONLY its search + filter controls (`showHeading={false}`), no
    // duplicate title. (The hero icon is intentionally dropped: TitleBlock is
    // frozen and renders title-only.)
    <PageLayout
      title={title ?? section.hero.title}
      subtitle={subtitle ?? section.hero.description}
      titleSize="h1"
      titleWrap
      backButton={backCfg}
      actions={actions}
      actionsVariant={actionsVariant}
    >
      <DevSectionView sectionKey={sectionKey} showHeading={false} preControls={preControls} showControls={showControls}>
        {children}
      </DevSectionView>
    </PageLayout>
  );

  // `shell` true → standalone `<PageShell>` (own <main> + bg + max-width).
  // false → padding-only box (no nested <main>) for hosts whose layout already
  // provides the container; both consume the host's `--page-shell-*` vars.
  return shell ? <PageShell>{inner}</PageShell> : <div className="page-shell-content">{inner}</div>;
}
