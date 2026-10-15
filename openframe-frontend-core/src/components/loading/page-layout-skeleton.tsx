import type React from 'react';
import { cn } from '../../utils/cn';
import { CardSkeletonGrid } from './card-skeleton';
import { LoadingRegion } from './loading-region';
import { UnifiedSkeleton, TextSkeleton, MediaSkeleton, InteractiveSkeleton } from './unified-skeleton';

interface PageLayoutSkeletonProps {
  className?: string;
}

/**
 * A whole loading state (a layout or a grid, not a piece of chrome): it announces itself once
 * (`LoadingRegion`). `region={false}` inside another loading region.
 */
interface LoadingLayoutProps extends PageLayoutSkeletonProps {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
}

/**
 * Announcement bar skeleton that matches the AnnouncementBar component
 */
export function AnnouncementBarSkeleton() {
  return (
    <div className="relative w-full bg-ods-card">
      <div className="relative flex w-full flex-row items-center">
        <div className="relative box-border flex w-full flex-row items-center justify-start gap-4 py-3 pl-4 pr-12 content-md:gap-6 content-md:py-4 content-md:pl-6 content-md:pr-16">
          {/* Logo skeleton */}
          <UnifiedSkeleton className="relative h-6 w-6 shrink-0 rounded content-md:h-8 content-md:w-8" />

          {/* Text content skeleton */}
          <div className="min-w-0 flex-1 space-y-1 content-md:space-y-2">
            <UnifiedSkeleton className="h-[14px] w-3/4 max-w-md rounded content-md:h-[18px]" />
            <UnifiedSkeleton className="hidden h-[12px] w-full max-w-lg rounded content-md:block content-md:h-[18px]" />
          </div>

          {/* Close button skeleton */}
          <UnifiedSkeleton className="absolute right-2 top-2 h-6 w-6 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Header skeleton for a page that is still loading: logo, navigation and action placeholders
 */
export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-ods-border bg-ods-card bg-ods-card/95 px-4 py-3 backdrop-blur-sm content-md:px-[80px] content-md:py-[12px]">
      {/* Left: Logo skeleton */}
      <div className="flex min-w-0 flex-1 items-center justify-start">
        <UnifiedSkeleton className="h-[26px] w-[110px] rounded content-md:h-8 content-md:w-[137px]" />
      </div>

      {/* Center: Navigation skeleton - hidden on mobile, visible on desktop */}
      <nav className="hidden min-w-0 flex-1 basis-1/3 items-center justify-center gap-2 content-md:flex">
        <div className="flex items-center gap-2">
          <InteractiveSkeleton.Button className="h-10 w-24" />
          <InteractiveSkeleton.Button className="h-10 w-24" />
          <InteractiveSkeleton.Button className="h-10 w-24" />
        </div>
      </nav>

      {/* Right: Actions skeleton */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
        {/* Mobile: Show hamburger skeleton */}
        <div className="content-md:hidden">
          <InteractiveSkeleton.Button className="h-10 w-10" />
        </div>

        {/* Desktop: Show action buttons skeletons */}
        <div className="hidden items-center gap-4 content-md:flex">
          <InteractiveSkeleton.Button className="h-10 w-10" />
          <InteractiveSkeleton.Button className="h-10 w-32" />
          <InteractiveSkeleton.Button className="h-10 w-20" />
        </div>
      </div>
    </header>
  );
}

/**
 * Hero section skeleton for static content areas
 */
export function HeroSkeleton() {
  return (
    <section
      className="flex w-full flex-col items-center justify-center px-4 py-12 text-center content-md:px-8 content-md:py-20"
      style={{
        background: 'radial-gradient(circle at 50% 0%, #242323 0%, #1A1A1A 100%)',
      }}
    >
      {/* Title skeleton */}
      <TextSkeleton.Heading className="mb-4 h-12 w-full max-w-4xl content-md:mb-6 content-md:h-20 content-lg:h-24" />

      {/* Subtitle skeleton */}
      <div className="mb-8 w-full max-w-4xl space-y-3 px-2 content-md:mb-10">
        <TextSkeleton.Body className="h-5 content-md:h-7" />
        <TextSkeleton.Body className="mx-auto h-5 w-3/4 content-md:h-7" />
      </div>

      {/* CTA Button skeleton */}
      <InteractiveSkeleton.Button className="h-12 w-full content-md:w-64" />
    </section>
  );
}

/**
 * Search container skeleton with filters
 */
export function SearchContainerSkeleton({
  className,
  showFilters = true,
}: PageLayoutSkeletonProps & { showFilters?: boolean }) {
  return (
    <div className={cn('space-y-4', className || '')}>
      {/* Search input and button */}
      <div className="flex gap-2 content-md:gap-4">
        <InteractiveSkeleton.Input className="flex-1" />
        <InteractiveSkeleton.Button className="w-32 content-md:w-40" />
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-2">
          <InteractiveSkeleton.Chip />
          <InteractiveSkeleton.Chip className="w-24" />
          <InteractiveSkeleton.Chip className="w-16" />
          <InteractiveSkeleton.Chip className="w-20" />
        </div>
      )}
    </div>
  );
}

/**
 * Category sidebar skeleton for filtering pages
 */
export function CategorySidebarSkeleton({ className }: PageLayoutSkeletonProps) {
  // Matches the actual MultiLevelNavigation sidebar with folder/file icons, README badges, and chevrons
  const items = [
    { type: 'file', width: 'w-20', hasBadge: false },
    { type: 'folder', width: 'w-24', hasBadge: true },
    { type: 'folder', width: 'w-20', hasBadge: true },
    { type: 'folder', width: 'w-24', hasBadge: true },
    { type: 'folder', width: 'w-16', hasBadge: true },
    { type: 'folder', width: 'w-20', hasBadge: true },
    { type: 'folder', width: 'w-28', hasBadge: true },
    { type: 'folder', width: 'w-16', hasBadge: true },
    { type: 'folder', width: 'w-24', hasBadge: true },
    { type: 'file', width: 'w-28' },
    { type: 'file', width: 'w-36' },
  ];

  return (
    <div className={cn('w-full content-lg:w-[320px]', className)}>
      {/* DATA ROOM label */}
      <UnifiedSkeleton className="mb-4 h-[14px] w-24 rounded" />

      {/* Navigation items — each has card background matching actual MultiLevelNavigation */}
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              'flex min-h-[50px] items-center justify-between rounded-lg border border-ods-border px-4 py-4',
              index === 0 ? 'bg-ods-accent/20' : 'bg-ods-card',
            )}
          >
            <div className="flex items-center gap-2.5">
              <UnifiedSkeleton className="h-4 w-4 shrink-0 rounded" />
              <UnifiedSkeleton className={`h-[14px] ${item.width} rounded`} />
            </div>
            <div className="flex h-[18px] items-center gap-2">
              {item.hasBadge && <UnifiedSkeleton className="h-[18px] w-14 rounded" />}
              {item.type === 'folder' && <UnifiedSkeleton className="h-4 w-4 rounded" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Breadcrumb navigation skeleton
 */
export function BreadcrumbSkeleton({ className }: PageLayoutSkeletonProps) {
  return (
    <div className={cn('mb-6 flex items-center space-x-1', className)}>
      <TextSkeleton.Caption className="w-16" />
      <UnifiedSkeleton variant="default" className="h-4 w-4 rounded-full" />
      <TextSkeleton.Caption className="w-24" />
      <UnifiedSkeleton variant="default" className="h-4 w-4 rounded-full" />
      <TextSkeleton.Caption className="w-32" />
      <UnifiedSkeleton variant="default" className="h-4 w-4 rounded-full" />
      <TextSkeleton.Caption className="w-24" />
    </div>
  );
}

/**
 * ONE breadcrumb link while it loads: a bar the height of the link's line
 * (`text-h6`), for a trail whose links stream in one by one.
 */
export function BreadcrumbLinkSkeleton({ className }: PageLayoutSkeletonProps) {
  return <UnifiedSkeleton as="span" className={cn('inline-block h-5 w-16', className)} />;
}

/**
 * Results header skeleton with count and sorting
 */
export function ResultsHeaderSkeleton({ className }: PageLayoutSkeletonProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col items-start justify-between gap-4 content-md:flex-row content-md:items-center',
        className,
      )}
    >
      <div className="space-y-1">
        <TextSkeleton.Body className="w-48" />
        {/* <TextSkeleton.Caption className="w-32" /> */}
      </div>
    </div>
  );
}

/**
 * Two-column layout skeleton (sidebar + main content)
 */
export function TwoColumnLayoutSkeleton({
  className,
  sidebarContent,
  mainContent,
  sidebarPosition = 'left',
  region = true,
}: LoadingLayoutProps & {
  sidebarContent?: React.ReactNode;
  mainContent?: React.ReactNode;
  sidebarPosition?: 'left' | 'right';
}) {
  const sidebar = sidebarContent || <CategorySidebarSkeleton />;
  // The layout announces for its parts: content passed in should not announce again (`region={false}`).
  const main = mainContent || <CardSkeletonGrid count={6} region={false} />;

  return (
    <LoadingRegion
      label="Loading"
      announce={region}
      className={cn(
        'grid grid-cols-1 gap-6 content-lg:grid-cols-[320px_1fr] content-lg:gap-8',
        sidebarPosition === 'right' && 'content-lg:grid-cols-[1fr_320px]',
        className,
      )}
    >
      {sidebarPosition === 'left' ? (
        <>
          <aside className="order-2 content-lg:order-1">{sidebar}</aside>
          <main className="order-1 content-lg:order-2">{main}</main>
        </>
      ) : (
        <>
          <main className="order-1">{main}</main>
          <aside className="order-2">{sidebar}</aside>
        </>
      )}
    </LoadingRegion>
  );
}

/**
 * Article/blog post layout skeleton
 */
export function ArticleLayoutSkeleton({ className, region = true }: LoadingLayoutProps) {
  return (
    <LoadingRegion
      label="Loading the article"
      as="article"
      announce={region}
      className={cn('mx-auto max-w-4xl', className)}
    >
      {/* Article header */}
      <header className="mb-8 space-y-4 content-md:mb-12 content-md:space-y-6">
        {/* Category/tags */}
        <div className="flex gap-2">
          <InteractiveSkeleton.Chip />
          <InteractiveSkeleton.Chip className="w-16" />
        </div>

        {/* Title */}
        <div className="space-y-3">
          <TextSkeleton.Heading className="w-full" />
          <TextSkeleton.Heading className="w-3/4" />
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 border-t border-ods-divider pt-4">
          <div className="flex items-center gap-2">
            <MediaSkeleton.Avatar size="sm" />
            <TextSkeleton.Caption className="w-24" />
          </div>
          <TextSkeleton.Caption className="w-20" />
          <TextSkeleton.Caption className="w-16" />
        </div>
      </header>

      {/* Featured image */}
      <div className="mb-8 content-md:mb-12">
        <MediaSkeleton.CardImage className="h-64 w-full content-md:h-96" />
      </div>

      {/* Article content */}
      <div className="prose prose-invert max-w-none space-y-6">
        {/* Paragraphs */}
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <TextSkeleton.Body className="w-full" />
            <TextSkeleton.Body className="w-full" />
            <TextSkeleton.Body className="w-5/6" />
            <TextSkeleton.Body className="w-3/4" />
          </div>
        ))}

        {/* Subheading in content */}
        <div className="py-4">
          <TextSkeleton.Subheading className="mb-4 w-2/3" />
          <div className="space-y-2">
            <TextSkeleton.Body className="w-full" />
            <TextSkeleton.Body className="w-4/5" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

/**
 * Vendor Detail Layout Skeleton - Complete vendor detail page structure
 * Matches the refactored vendor detail page with proper platform colors and responsive layout
 */
export function VendorDetailLayoutSkeleton({ className, region = true }: LoadingLayoutProps) {
  return (
    <LoadingRegion
      label="Loading the vendor"
      as="main"
      announce={region}
      className={cn('min-h-screen bg-ods-bg', className)}
    >
      <div className="mx-auto max-w-[1920px] px-6 py-6 content-md:px-20 content-md:py-10">
        {/* Breadcrumb */}
        <BreadcrumbSkeleton className="mb-6" />

        {/* Main Layout Container */}
        <div className="flex flex-col content-lg:flex-row content-lg:gap-10">
          {/* Left Content Area */}
          <div className="min-w-0 flex-1">
            {/* Vendor Hero Section */}
            <div className="mb-10">
              {/* Header - Logo and Title Side by Side */}
              <div className="mb-6 flex gap-6">
                <UnifiedSkeleton className="h-20 w-20 flex-shrink-0 rounded-lg border border-ods-border" />

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    {/* Large title skeleton */}
                    <UnifiedSkeleton className="h-12 w-80 max-w-full rounded content-md:h-16 content-lg:h-20" />
                    {/* Category text */}
                    <UnifiedSkeleton className="h-5 w-32 rounded content-md:h-6" />
                  </div>

                  {/* Pricing tags */}
                  <div className="flex items-center gap-2">
                    <UnifiedSkeleton className="h-8 w-20 rounded" />
                    <UnifiedSkeleton className="h-8 w-16 rounded" />
                  </div>
                </div>
              </div>

              {/* Vendor Image Display Skeleton */}
              <UnifiedSkeleton className="mb-2 h-[300px] w-full rounded-lg border border-ods-border content-md:h-[400px] content-lg:h-[500px]" />
              <div className="text-center">
                <UnifiedSkeleton className="mx-auto h-4 w-24 rounded" />
              </div>
            </div>

            {/* Mobile Sidebar - Show on mobile only, positioned after title */}
            <div className="mb-10 content-lg:hidden">
              <div className="space-y-4">
                {/* Deploy Button */}
                <UnifiedSkeleton className="h-12 rounded-lg border border-ods-border" />

                {/* Voting Buttons */}
                <div className="space-y-2">
                  <UnifiedSkeleton className="h-12 rounded-lg border border-ods-border" />
                  <UnifiedSkeleton className="h-12 rounded-lg border border-ods-border" />
                </div>

                {/* GitHub Score Section */}
                <div className="overflow-hidden rounded-lg border border-ods-border">
                  {/* Header */}
                  <div className="flex items-center gap-3 bg-ods-card p-4">
                    <UnifiedSkeleton className="h-8 w-8 rounded" />
                    <div className="flex flex-col gap-1">
                      <UnifiedSkeleton className="h-4 w-20 rounded" />
                      <UnifiedSkeleton className="h-6 w-12 rounded" />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <UnifiedSkeleton className="h-6 w-6 rounded" />
                        <div className="flex items-end gap-1">
                          <UnifiedSkeleton className="h-4 w-12 rounded" />
                          <UnifiedSkeleton className="h-3 w-8 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <UnifiedSkeleton className="h-12 rounded-lg border border-ods-border" />
                  <UnifiedSkeleton className="h-12 rounded-lg border border-ods-border" />
                  <UnifiedSkeleton className="h-12 rounded-lg border border-ods-border" />
                </div>
              </div>
            </div>

            {/* Alternatives Container */}
            <div className="mb-20 flex flex-col gap-6">
              <UnifiedSkeleton className="h-8 w-48 rounded content-md:h-10" />

              {/* Open Source Alternatives */}
              <div className="flex flex-col gap-4">
                <UnifiedSkeleton className="h-5 w-48 rounded" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <UnifiedSkeleton key={i} className="h-10 w-24 rounded-lg border border-ods-border" />
                  ))}
                </div>
              </div>

              {/* Commercial Alternatives */}
              <div className="flex flex-col gap-4">
                <UnifiedSkeleton className="h-5 w-52 rounded" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <UnifiedSkeleton key={i} className="h-10 w-28 rounded-lg border border-ods-border" />
                  ))}
                </div>
              </div>
            </div>

            {/* About Section */}
            <div className="mb-20 flex flex-col gap-6">
              <UnifiedSkeleton className="h-8 w-64 rounded content-md:h-10" />

              <div className="rounded-lg border border-ods-border bg-ods-card p-6 content-md:p-8">
                <div className="space-y-4">
                  <UnifiedSkeleton className="h-6 rounded" />
                  <UnifiedSkeleton className="h-6 rounded" />
                  <UnifiedSkeleton className="h-6 w-5/6 rounded" />
                  <UnifiedSkeleton className="h-6 w-4/5 rounded" />
                </div>
              </div>
            </div>

            {/* Key Features Section */}
            <div className="mb-20 flex flex-col gap-6">
              <UnifiedSkeleton className="h-8 w-72 rounded content-md:h-10" />
              <div className="grid grid-cols-1 gap-6 content-md:grid-cols-2 content-lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-4 rounded-lg border border-ods-border bg-ods-card p-4">
                    <UnifiedSkeleton className="h-12 w-12 flex-shrink-0 rounded" />
                    <div className="flex-1 space-y-2">
                      <UnifiedSkeleton className="h-5 w-3/4 rounded" />
                      <UnifiedSkeleton className="h-4 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pros and Cons Section */}
            <div className="mb-20 flex flex-col gap-6">
              <UnifiedSkeleton className="h-8 w-80 rounded content-md:h-10" />
              <div className="grid grid-cols-1 gap-6 content-lg:grid-cols-2">
                {/* Pros Column */}
                <div className="flex flex-col gap-6">
                  <UnifiedSkeleton className="h-5 w-16 rounded" />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3 rounded-lg border border-ods-border bg-ods-card p-4">
                      <UnifiedSkeleton className="h-12 w-12 flex-shrink-0 rounded border border-ods-border" />
                      <div className="flex-1 space-y-2">
                        <UnifiedSkeleton className="h-5 w-2/3 rounded" />
                        <UnifiedSkeleton className="h-4 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Cons Column */}
                <div className="flex flex-col gap-6">
                  <UnifiedSkeleton className="h-5 w-16 rounded" />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3 rounded-lg border border-ods-border bg-ods-card p-4">
                      <UnifiedSkeleton className="h-12 w-12 flex-shrink-0 rounded border border-ods-border" />
                      <div className="flex-1 space-y-2">
                        <UnifiedSkeleton className="h-5 w-2/3 rounded" />
                        <UnifiedSkeleton className="h-4 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alternatives Section */}
            <div className="mb-20 flex flex-col gap-6">
              <UnifiedSkeleton className="h-8 w-72 rounded content-md:h-10" />
              <div className="grid grid-cols-1 gap-6 content-md:grid-cols-2 content-lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-4 rounded-lg border border-ods-border bg-ods-card p-6">
                    {/* Header */}
                    <div className="flex items-start gap-4">
                      <UnifiedSkeleton className="h-16 w-16 flex-shrink-0 rounded-lg border border-ods-border" />
                      <div className="flex-1 space-y-2">
                        <UnifiedSkeleton className="h-6 w-3/4 rounded" />
                        <UnifiedSkeleton className="h-4 w-1/2 rounded" />
                      </div>
                      <UnifiedSkeleton className="h-6 w-20 rounded" />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <UnifiedSkeleton className="h-4 rounded" />
                      <UnifiedSkeleton className="h-4 w-5/6 rounded" />
                      <UnifiedSkeleton className="h-4 w-4/5 rounded" />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-ods-border pt-2">
                      <UnifiedSkeleton className="h-4 w-16 rounded" />
                      <UnifiedSkeleton className="h-4 w-20 rounded" />
                    </div>
                  </div>
                ))}
              </div>
              {/* Show All Button */}
              <UnifiedSkeleton className="h-12 rounded-md" />
            </div>

            {/* Comments Section */}
            <div className="mb-20 flex flex-col gap-6">
              <UnifiedSkeleton className="h-8 w-64 rounded content-md:h-10" />

              {/* Comment Form Skeleton */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 overflow-hidden rounded-lg border border-ods-border bg-ods-bg">
                    {/* Title Section */}
                    <div className="border-b border-ods-border p-3">
                      <UnifiedSkeleton className="mb-2 h-3 w-8 rounded" />
                      <UnifiedSkeleton className="h-6 w-full rounded" />
                    </div>

                    {/* Description Section */}
                    <div className="p-3">
                      <UnifiedSkeleton className="mb-2 h-3 w-16 rounded" />
                      <div className="space-y-2">
                        <UnifiedSkeleton className="h-4 w-full rounded" />
                        <UnifiedSkeleton className="h-4 w-3/4 rounded" />
                        <UnifiedSkeleton className="h-4 w-1/2 rounded" />
                      </div>
                    </div>
                  </div>

                  {/* Send Button */}
                  <div className="flex items-stretch">
                    <UnifiedSkeleton className="h-[120px] w-20 rounded-lg" />
                  </div>
                </div>
              </div>

              {/* Sample Comment Cards */}
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-ods-border bg-ods-card p-4">
                    {/* Comment Header */}
                    <div className="mb-3 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-2">
                      <div className="flex items-center gap-2">
                        {/* User Info */}
                        <div className="flex items-center gap-2 rounded-lg border border-ods-border bg-ods-card px-3 py-2">
                          <UnifiedSkeleton className="h-8 w-8 rounded-lg" />
                          <UnifiedSkeleton className="h-4 w-20 rounded" />
                        </div>

                        {/* Timestamp */}
                        <UnifiedSkeleton className="h-4 w-12 rounded" />
                      </div>
                    </div>

                    {/* Comment Content */}
                    <div className="space-y-2">
                      <UnifiedSkeleton className="h-6 w-2/3 rounded" />
                      <div className="space-y-1">
                        <UnifiedSkeleton className="h-4 w-full rounded" />
                        <UnifiedSkeleton className="h-4 w-4/5 rounded" />
                        <UnifiedSkeleton className="h-4 w-3/5 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Desktop Only */}
          <div className="hidden w-[290px] flex-shrink-0 content-lg:block">
            <div className="space-y-4">
              {/* Deploy Button */}
              <UnifiedSkeleton className="h-12 rounded-lg border border-ods-border" />

              {/* Voting Buttons */}
              <div className="space-y-2">
                <UnifiedSkeleton className="h-12 rounded-lg border border-ods-border" />
                <UnifiedSkeleton className="h-12 rounded-lg border border-ods-border" />
              </div>

              {/* GitHub Score Section */}
              <div className="overflow-hidden rounded-lg border border-ods-border">
                {/* Header */}
                <div className="flex items-center gap-3 bg-ods-card p-4">
                  <UnifiedSkeleton className="h-8 w-8 rounded" />
                  <div className="flex flex-col gap-1">
                    <UnifiedSkeleton className="h-4 w-20 rounded" />
                    <UnifiedSkeleton className="h-6 w-12 rounded" />
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-3 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <UnifiedSkeleton className="h-6 w-6 rounded" />
                      <div className="flex items-end gap-1">
                        <UnifiedSkeleton className="h-4 w-12 rounded" />
                        <UnifiedSkeleton className="h-3 w-8 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <UnifiedSkeleton className="h-12 rounded-lg border border-ods-border" />
                <UnifiedSkeleton className="h-12 rounded-lg border border-ods-border" />
                <UnifiedSkeleton className="h-12 rounded-lg border border-ods-border" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

/**
 * Stats/features section skeleton for homepage
 */
export function StatsSectionSkeleton({ className, columns = 3 }: PageLayoutSkeletonProps & { columns?: number }) {
  return (
    <div
      className={cn(
        'mb-12 grid gap-6 content-md:mb-16',
        columns === 3 && 'grid-cols-1 content-md:grid-cols-3',
        columns === 4 && 'grid-cols-1 content-md:grid-cols-2 content-lg:grid-cols-4',
        className,
      )}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="rounded-lg border border-ods-border bg-ods-card p-6">
          <div className="space-y-4">
            <MediaSkeleton.Icon size="lg" />
            <TextSkeleton.Subheading className="w-3/4" />
            <div className="space-y-2">
              <TextSkeleton.Body className="w-full" />
              <TextSkeleton.Body className="w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Blog Card Grid Skeleton - Always displays exactly 4 blog card skeletons
 * Used for consistent blog page layout with predictable height
 */
export function BlogCardGridSkeleton({ className, region = true }: LoadingLayoutProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <CardSkeletonGrid count={4} variant="blog" region={region} className="grid-cols-1 content-md:grid-cols-2" />
    </div>
  );
}

/**
 * Vendor Grid Skeleton - Always displays exactly 12 vendor card skeletons
 * Used for consistent vendor page layout with predictable height
 */
export function VendorGridSkeleton({ className, region = true }: LoadingLayoutProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <CardSkeletonGrid
        count={12}
        variant="vendor"
        region={region}
        className="grid-cols-1 content-md:grid-cols-2 content-lg:grid-cols-3"
      />
    </div>
  );
}

/**
 * Slack Community Section Skeleton
 * Matches SlackCommunity component structure with title, channel list, and chat interface
 */
export function SlackCommunitySkeleton({ region = true }: { region?: boolean } = {}) {
  return (
    <LoadingRegion
      label="Loading the Slack community"
      as="section"
      announce={region}
      className="w-full bg-ods-bg px-4 py-12 content-md:px-20 content-md:py-20 content-lg:px-20"
    >
      {/* Frame 651 Container */}
      <div className="flex w-full flex-col gap-4 content-md:gap-6">
        {/* Title Skeleton */}
        <div className="w-full">
          <UnifiedSkeleton className="h-8 max-w-md rounded-lg content-md:h-12 content-lg:h-14" />
        </div>

        {/* Content Area - Channel List + Chat Interface */}
        <div className="flex w-full min-w-0 flex-col gap-4 content-md:gap-6 content-lg:flex-row content-lg:items-start content-lg:justify-end">
          {/* Channel List Skeleton */}
          <div className="flex w-full flex-shrink-0 flex-col overflow-hidden rounded border border-ods-border bg-ods-bg content-lg:w-[290px] content-lg:max-w-[290px]">
            <div className="space-y-4 p-4">
              {/* Header */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <UnifiedSkeleton className="h-4 w-24 rounded" />
                  <UnifiedSkeleton className="h-3 w-16 rounded" />
                </div>
                <UnifiedSkeleton className="h-3 w-32 rounded" />
              </div>

              {/* Channels */}
              <div className="flex flex-col gap-1">
                <UnifiedSkeleton className="mb-2 h-3 w-16 rounded" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex min-h-[48px] items-center gap-2 px-2 py-3">
                    <UnifiedSkeleton className="h-4 w-4 rounded" />
                    <div className="flex-1">
                      <UnifiedSkeleton className="mb-1 h-3 w-24 rounded" />
                      <UnifiedSkeleton className="h-2 w-16 rounded" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="mt-2 border-t border-ods-border pt-3">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <UnifiedSkeleton className="h-3 w-16 rounded" />
                    <UnifiedSkeleton className="h-3 w-8 rounded" />
                  </div>
                  <div className="flex justify-between">
                    <UnifiedSkeleton className="h-3 w-20 rounded" />
                    <UnifiedSkeleton className="h-3 w-8 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Interface Skeleton */}
          <div className="flex h-[450px] min-h-[450px] min-w-0 flex-1 flex-col rounded-lg border border-ods-border bg-ods-card content-md:h-[500px] content-md:min-h-[500px] content-lg:h-[600px] content-lg:min-h-[600px]">
            {/* Header */}
            <div className="flex h-[56px] flex-shrink-0 items-center justify-between border-b border-ods-border bg-ods-bg p-4 content-md:h-[60px] content-md:p-6">
              <div className="flex items-center gap-2">
                <UnifiedSkeleton className="h-3 w-3 rounded content-md:h-4 content-md:w-4" />
                <UnifiedSkeleton className="h-3 w-24 rounded content-md:h-4 content-md:w-32" />
              </div>
              <UnifiedSkeleton className="h-3 w-12 rounded content-md:w-16" />
            </div>

            {/* Messages */}
            <div className="min-h-[280px] flex-1 space-y-3 overflow-hidden bg-ods-bg p-4 content-md:min-h-[320px] content-md:space-y-4 content-md:p-6 content-lg:min-h-[420px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-2 content-md:gap-3">
                  <UnifiedSkeleton className="h-10 w-10 flex-shrink-0 rounded-lg content-md:h-12 content-md:w-12" />
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <UnifiedSkeleton className="h-3 w-16 rounded content-md:w-20" />
                      <UnifiedSkeleton className="h-3 w-12 rounded content-md:w-16" />
                    </div>
                    <UnifiedSkeleton className="h-3 w-full rounded content-md:h-4" />
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="h-[72px] flex-shrink-0 border-t border-ods-border bg-ods-card p-4 content-md:h-[80px] content-md:p-6">
              <div className="flex items-end justify-center gap-3 content-md:justify-end">
                <UnifiedSkeleton className="h-10 w-28 rounded-lg content-md:h-12 content-md:w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
