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

const SECTION_HERO_ICON_CLASS = 'h-10 w-10 text-ods-accent';

export interface DevSectionPageProps {
  sectionKey: OpenframeDevSectionKey;
  /** The page-specific list body (e.g. `<RoadmapList />`). */
  children: ReactNode;
  /** Back-button config — same shape as `LegalDocumentPage` /
   *  `ReleaseDetailPage`. Pass `false` to hide. Default
   *  `{ label: 'Back to home', href: '/' }`. */
  backButton?: { label?: string; href?: string } | false;
}

export function DevSectionPage({ sectionKey, children, backButton }: DevSectionPageProps) {
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
            description: section.hero.description,
          }}
        >
          {children}
        </DevSectionView>
      </PageLayout>
    </PageShell>
  );
}
