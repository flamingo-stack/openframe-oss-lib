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
import { PageShell, PageLayout } from '../../ui';
import { DevSectionView } from './dev-section-view';
import {
  OPENFRAME_DEV_SECTIONS,
  type OpenframeDevSectionKey,
} from '../../../utils/dev-sections/openframe-dev-sections';

/** Re-export the constant so existing dev-section call sites keep their
 *  old import path. The canonical home is `src/utils/page-header-constants.ts`
 *  (NOT a `'use client'` module) so server modules can import it without
 *  Next.js turning it into a client reference proxy — that proxy is what
 *  blew up lucide's `mergeClasses().trim()` when used as
 *  `<Icon className={SECTION_HERO_ICON_CLASS} />` inside a hub
 *  server-component preset. */
import { SECTION_HERO_ICON_CLASS } from '../../../utils/page-header-constants';
export { SECTION_HERO_ICON_CLASS };

export interface DevSectionPageProps {
  sectionKey: OpenframeDevSectionKey;
  /** The page-specific list body (e.g. `<RoadmapList />`). */
  children: ReactNode;
  /** Optional slot rendered BETWEEN the hero and search/filter — see
   *  `DevSectionView.preControls`. Used by surfaces that want an entry
   *  action (e.g. Help Center's "Open a new ticket" form) above the
   *  controls instead of below them. */
  preControls?: ReactNode;
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
}

export function DevSectionPage({
  sectionKey,
  children,
  preControls,
  backButton,
  title,
  subtitle,
}: DevSectionPageProps) {
  const router = useRouter();
  const section = OPENFRAME_DEV_SECTIONS[sectionKey];
  const Icon = section.icon;

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

  return (
    <PageShell>
      <PageLayout backButton={backCfg}>
        <DevSectionView
          sectionKey={sectionKey}
          hero={{
            icon: <Icon className={SECTION_HERO_ICON_CLASS} />,
            title,
            description: subtitle ?? section.hero.description,
          }}
          preControls={preControls}
        >
          {children}
        </DevSectionView>
      </PageLayout>
    </PageShell>
  );
}
