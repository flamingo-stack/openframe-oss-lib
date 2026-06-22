import React from 'react';
import { cn } from '../../utils/cn';

/**
 * Unified page layout components.
 *
 * PageShell: full-width <main> for list pages, dashboards, and other wide
 * layouts (max-w-[1920px]) — bg + min-height + centered, max-width content box.
 * ArticleDetailLayout: the same shell constrained to a readable article width
 * (max-w-[1280px]) — blog posts, release notes, case studies, etc.
 * Child components render content only; no layout wrappers needed.
 *
 * Outer padding is driven by CSS custom properties (see
 * `styles/ods-page-shell.css`), so an embedder matches its host grid by setting
 * the `--page-shell-*` vars on ANY ancestor — no prop-threading through the lib
 * wrappers (DevSectionPage / LegalDocumentPage / ReleaseDetailPage / …), no
 * imperative global, no context. The cascade scopes each override to its own
 * subtree. Per-instance escape hatch: `contentClassName` (Tailwind padding
 * utilities there win over the class defaults).
 */

interface LayoutProps {
  children: React.ReactNode;
  /** JSON-LD schema script elements (breadcrumbs, article schema, etc.) */
  schemas?: React.ReactNode;
  /** Per-instance class override on the content box (wins over the var defaults). */
  contentClassName?: string;
}

/**
 * Full-width page shell for list pages, dashboards, and other wide layouts.
 * Max width: 1920px.
 *
 * No `min-h-screen` here on purpose: the root layout already wraps page
 * content in a `flex min-h-screen flex-col` → `flex-1` chain (app/layout.tsx),
 * so the footer is pushed to the bottom of the viewport on short pages without
 * this shell forcing its own 100vh. Adding `min-h-screen` here stacks a second
 * full viewport INSIDE that growing `flex-1`, which only manifests as dead
 * space when the shell is a hero section above sibling content
 * (roadmap-and-releases). There is no case where the shell itself should fill
 * the viewport.
 */
export function PageShell({ children, schemas, contentClassName }: LayoutProps) {
  return (
    <main className="bg-ods-bg">
      {schemas}
      <div className={cn('page-shell-content max-w-[1920px] mx-auto', contentClassName)}>
        {children}
      </div>
    </main>
  );
}

/**
 * Constrained layout for article/detail pages (max-w-[1280px]) — readable
 * content width for blog posts, release notes, case studies, investor updates.
 * Fixed hub padding (`px-6 md:px-20 py-6 md:py-10`); pass `contentClassName` to
 * override per instance. (PageShell's `--page-shell-*` var system does NOT apply
 * here — this layout keeps its own fixed spacing.)
 */
export function ArticleDetailLayout({ children, schemas, contentClassName }: LayoutProps) {
  return (
    <main className="bg-ods-bg">
      {schemas}
      <div className={cn('max-w-[1280px] mx-auto px-6 md:px-20 py-6 md:py-10', contentClassName)}>
        {children}
      </div>
    </main>
  );
}
