import React from 'react';

/**
 * Unified page layout components.
 *
 * PageShell: Full-width layout for list pages (max-w-[1920px])
 * ArticleDetailLayout: Constrained layout for detail pages (max-w-[1280px])
 *
 * Both provide: <main> + bg-ods-bg + responsive padding + max-width + centering.
 * Child components should render content only — no layout wrappers needed.
 */

interface LayoutProps {
  children: React.ReactNode;
  /** JSON-LD schema script elements (breadcrumbs, article schema, etc.) */
  schemas?: React.ReactNode;
}

/**
 * Full-width page shell for list pages, dashboards, and other wide layouts.
 * Max width: 1920px.
 */
export function PageShell({ children, schemas }: LayoutProps) {
  return (
    <main className="bg-ods-bg min-h-screen">
      {schemas}
      <div className="max-w-[1920px] mx-auto px-6 md:px-20 py-6 md:py-10">
        {children}
      </div>
    </main>
  );
}

/**
 * Constrained layout for article/detail pages.
 * Max width: 1280px for readable content width.
 * Used by: release pages, blog posts, case studies, investor updates, interviews.
 */
export function ArticleDetailLayout({ children, schemas }: LayoutProps) {
  return (
    <main className="bg-ods-bg min-h-screen">
      {schemas}
      <div className="max-w-[1280px] mx-auto px-6 md:px-20 py-6 md:py-10">
        {children}
      </div>
    </main>
  );
}
