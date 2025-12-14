import type React from "react"
import { cn } from "../../utils/cn"
import { UnifiedSkeleton, TextSkeleton, MediaSkeleton, InteractiveSkeleton } from "./unified-skeleton"
import { CardSkeletonGrid } from "./card-skeleton"

interface PageLayoutSkeletonProps {
  className?: string
}

/**
 * Announcement bar skeleton that matches the AnnouncementBar component
 */
export function AnnouncementBarSkeleton() {
  return (
    <div className="bg-[#2A2A2A] relative w-full animate-pulse">
      <div className="flex flex-row items-center relative w-full">
        <div className="box-border flex flex-row gap-4 md:gap-6 items-center justify-start pl-4 md:pl-6 pr-12 md:pr-16 py-3 md:py-4 relative w-full">
          {/* Logo skeleton */}
          <div className="relative shrink-0 w-6 h-6 md:w-8 md:h-8 bg-ods-border rounded"></div>
          
          {/* Text content skeleton */}
          <div className="flex-1 min-w-0 space-y-1 md:space-y-2">
            <div className="h-[14px] md:h-[18px] bg-ods-border rounded w-3/4 max-w-md"></div>
            <div className="h-[12px] md:h-[18px] bg-ods-border rounded w-full max-w-lg hidden sm:block"></div>
          </div>
          
          {/* Close button skeleton */}
          <div className="absolute right-2 top-2 w-6 h-6 bg-ods-border rounded"></div>
        </div>
      </div>
    </div>
  )
}

/**
 * Header skeleton that matches the ClientOnlyHeader placeholder but with proper animations
 */
export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-40 w-full flex items-center justify-between border-b border-ods-border bg-ods-card backdrop-blur-sm bg-ods-card/95 px-4 md:px-[80px] py-3 md:py-[12px] animate-pulse">
      {/* Left: Logo skeleton */}
      <div className="flex items-center justify-start flex-1 min-w-0">
        <div className="w-[110px] h-[26px] md:w-[137px] md:h-8 bg-[#2A2A2A] rounded"></div>
      </div>

      {/* Center: Navigation skeleton - hidden on mobile, visible on desktop */}
      <nav className="hidden md:flex flex-1 basis-1/3 justify-center items-center gap-2 min-w-0">
        <div className="flex items-center gap-2">
          <InteractiveSkeleton.Button className="w-24 h-10" />
          <InteractiveSkeleton.Button className="w-24 h-10" />
          <InteractiveSkeleton.Button className="w-24 h-10" />
        </div>
      </nav>

      {/* Right: Actions skeleton */}
      <div className="flex items-center justify-end gap-4 flex-1 min-w-0">
        {/* Mobile: Show hamburger skeleton */}
        <div className="md:hidden">
          <InteractiveSkeleton.Button className="h-10 w-10" />
        </div>
        
        {/* Desktop: Show action buttons skeletons */}
        <div className="hidden md:flex items-center gap-4">
          <InteractiveSkeleton.Button className="w-10 h-10" />
          <InteractiveSkeleton.Button className="w-32 h-10" />
          <InteractiveSkeleton.Button className="w-20 h-10" />
        </div>
      </div>
    </header>
  )
}

/**
 * Hero section skeleton for static content areas
 */
export function HeroSkeleton() {
  return (
    <section
      className="w-full flex flex-col items-center justify-center py-12 px-4 md:py-20 md:px-8 text-center animate-pulse"
      style={{
        background: 'radial-gradient(circle at 50% 0%, #242323 0%, #1A1A1A 100%)'
      }}
    >
      {/* Title skeleton */}
      <TextSkeleton.Heading className="h-12 sm:h-16 md:h-20 lg:h-24 mb-4 md:mb-6 max-w-4xl w-full" />
      
      {/* Subtitle skeleton */}
      <div className="space-y-3 mb-8 md:mb-10 max-w-4xl w-full px-2">
        <TextSkeleton.Body className="h-5 sm:h-6 md:h-7" />
        <TextSkeleton.Body className="h-5 sm:h-6 md:h-7 w-3/4 mx-auto" />
      </div>
      
      {/* CTA Button skeleton */}
      <InteractiveSkeleton.Button className="w-full sm:w-64 h-12" />
    </section>
  )
}

/**
 * Search container skeleton with filters
 */
export function SearchContainerSkeleton({ 
  className,
  showFilters = true 
}: PageLayoutSkeletonProps & { showFilters?: boolean }) {
  return (
    <div className={cn("space-y-4", className || "")}>
      {/* Search input and button */}
      <div className="flex gap-2 md:gap-4">
        <InteractiveSkeleton.Input className="flex-1" />
        <InteractiveSkeleton.Button className="w-32 md:w-40" />
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex gap-2 flex-wrap">
          <InteractiveSkeleton.Chip />
          <InteractiveSkeleton.Chip className="w-24" />
          <InteractiveSkeleton.Chip className="w-16" />
          <InteractiveSkeleton.Chip className="w-20" />
        </div>
      )}
    </div>
  )
}

/**
 * Category sidebar skeleton for filtering pages
 */
export function CategorySidebarSkeleton({ className }: PageLayoutSkeletonProps) {
  return (
    <div className={cn("w-full lg:w-[320px] space-y-6", className)}>
      <div className="bg-ods-card border border-ods-border rounded-lg p-4 md:p-6">
        {/* Sidebar header */}
        <TextSkeleton.Subheading className="mb-4 w-1/2" />
        
        {/* Category list */}
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between">
              <TextSkeleton.Body className="w-3/4" />
              <TextSkeleton.Caption className="w-8" />
            </div>
          ))}
        </div>
      </div>

      {/* Additional filter sections */}
      <div className="bg-ods-card border border-ods-border rounded-lg p-4 md:p-6">
        <TextSkeleton.Subheading className="mb-4 w-1/3" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <UnifiedSkeleton variant="default" className="w-4 h-4" />
              <TextSkeleton.Body className="w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Breadcrumb navigation skeleton
 */
export function BreadcrumbSkeleton({ className }: PageLayoutSkeletonProps) {
  return (
    <div className={cn("flex items-center space-x-1 mb-6", className)}>
      <TextSkeleton.Caption className="w-16" />
      <UnifiedSkeleton variant="default" className="w-4 h-4 rounded-full" />
      <TextSkeleton.Caption className="w-24" />
      <UnifiedSkeleton variant="default" className="w-4 h-4 rounded-full" />
      <TextSkeleton.Caption className="w-32" />
      <UnifiedSkeleton variant="default" className="w-4 h-4 rounded-full" />
      <TextSkeleton.Caption className="w-24" />
    </div>
  )
}

/**
 * Results header skeleton with count and sorting
 */
export function ResultsHeaderSkeleton({ className }: PageLayoutSkeletonProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6", className)}>
      <div className="space-y-1">
        <TextSkeleton.Body className="w-48" />
        {/* <TextSkeleton.Caption className="w-32" /> */}
      </div>
    </div>
  )
}

/**
 * Two-column layout skeleton (sidebar + main content)
 */
export function TwoColumnLayoutSkeleton({
  className,
  sidebarContent,
  mainContent,
  sidebarPosition = 'left'
}: PageLayoutSkeletonProps & {
  sidebarContent?: React.ReactNode
  mainContent?: React.ReactNode
  sidebarPosition?: 'left' | 'right'
}) {
  const sidebar = sidebarContent || <CategorySidebarSkeleton />
  const main = mainContent || <CardSkeletonGrid count={6} />

  return (
    <div className={cn(
      "grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 lg:gap-8",
      sidebarPosition === 'right' && "lg:grid-cols-[1fr_320px]",
      className
    )}>
      {sidebarPosition === 'left' ? (
        <>
          <aside className="order-2 lg:order-1">{sidebar}</aside>
          <main className="order-1 lg:order-2">{main}</main>
        </>
      ) : (
        <>
          <main className="order-1">{main}</main>
          <aside className="order-2">{sidebar}</aside>
        </>
      )}
    </div>
  )
}

/**
 * Article/blog post layout skeleton
 */
export function ArticleLayoutSkeleton({ className }: PageLayoutSkeletonProps) {
  return (
    <article className={cn("max-w-4xl mx-auto", className)}>
      {/* Article header */}
      <header className="mb-8 md:mb-12 space-y-4 md:space-y-6">
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
        <div className="flex items-center gap-4 pt-4 border-t border-ods-divider">
          <div className="flex items-center gap-2">
            <MediaSkeleton.Avatar size="sm" />
            <TextSkeleton.Caption className="w-24" />
          </div>
          <TextSkeleton.Caption className="w-20" />
          <TextSkeleton.Caption className="w-16" />
        </div>
      </header>

      {/* Featured image */}
      <div className="mb-8 md:mb-12">
        <MediaSkeleton.CardImage className="w-full h-64 md:h-96" />
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
          <TextSkeleton.Subheading className="w-2/3 mb-4" />
          <div className="space-y-2">
            <TextSkeleton.Body className="w-full" />
            <TextSkeleton.Body className="w-4/5" />
          </div>
        </div>
      </div>
    </article>
  )
}

/**
 * Vendor Detail Layout Skeleton - Complete vendor detail page structure
 * Matches the refactored vendor detail page with proper platform colors and responsive layout
 */
export function VendorDetailLayoutSkeleton({ className }: PageLayoutSkeletonProps) {
  return (
    <main className={cn("bg-[#161616] min-h-screen", className)}>
      <div className="max-w-[1920px] mx-auto px-6 md:px-20 py-6 md:py-10">
        {/* Breadcrumb */}
        <BreadcrumbSkeleton className="mb-6" />

        {/* Main Layout Container */}
        <div className="flex flex-col lg:flex-row lg:gap-10">
          {/* Left Content Area */}
          <div className="flex-1 min-w-0">
            
            {/* Vendor Hero Section */}
            <div className="mb-10">
              {/* Header - Logo and Title Side by Side */}
              <div className="flex gap-6 mb-6">
                <div className="w-20 h-20 bg-ods-card border border-ods-border rounded-lg animate-pulse flex-shrink-0"></div>
                
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    {/* Large title skeleton */}
                    <div className="h-12 md:h-16 lg:h-20 bg-[#2A2A2A] rounded animate-pulse w-80 max-w-full"></div>
                    {/* Category text */}
                    <div className="h-5 md:h-6 bg-[#2A2A2A] rounded animate-pulse w-32"></div>
                  </div>
                  
                  {/* Pricing tags */}
                  <div className="flex items-center gap-2">
                    <div className="h-8 bg-[#2A2A2A] rounded animate-pulse w-20"></div>
                    <div className="h-8 bg-[#2A2A2A] rounded animate-pulse w-16"></div>
                  </div>
                </div>
              </div>

              {/* Vendor Image Display Skeleton */}
              <div className="w-full h-[300px] md:h-[400px] lg:h-[500px] bg-ods-card border border-ods-border rounded-lg animate-pulse mb-2"></div>
              <div className="text-center">
                <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-24 mx-auto"></div>
              </div>
            </div>

            {/* Mobile Sidebar - Show on mobile only, positioned after title */}
            <div className="lg:hidden mb-10">
              <div className="space-y-4">
                {/* Deploy Button */}
                <div className="h-12 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
                
                {/* Voting Buttons */}
                <div className="space-y-2">
                  <div className="h-12 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
                  <div className="h-12 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
                </div>
                
                {/* GitHub Score Section */}
                <div className="border border-ods-border rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="bg-ods-card p-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#2A2A2A] rounded animate-pulse"></div>
                    <div className="flex flex-col gap-1">
                      <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-20"></div>
                      <div className="h-6 bg-[#2A2A2A] rounded animate-pulse w-12"></div>
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-[#2A2A2A] rounded animate-pulse"></div>
                        <div className="flex items-end gap-1">
                          <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-12"></div>
                          <div className="h-3 bg-[#2A2A2A] rounded animate-pulse w-8"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="space-y-3">
                  <div className="h-12 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
                  <div className="h-12 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
                  <div className="h-12 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Alternatives Container */}
            <div className="flex flex-col gap-6 mb-20">
              <div className="h-8 md:h-10 bg-[#2A2A2A] rounded animate-pulse w-48"></div>
              
              {/* Open Source Alternatives */}
              <div className="flex flex-col gap-4">
                <div className="h-5 bg-[#2A2A2A] rounded animate-pulse w-48"></div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 bg-ods-card border border-ods-border rounded-lg animate-pulse w-24"></div>
                  ))}
                </div>
              </div>

              {/* Commercial Alternatives */}
              <div className="flex flex-col gap-4">
                <div className="h-5 bg-[#2A2A2A] rounded animate-pulse w-52"></div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-10 bg-ods-card border border-ods-border rounded-lg animate-pulse w-28"></div>
                  ))}
                </div>
              </div>
            </div>

            {/* About Section */}
            <div className="flex flex-col gap-6 mb-20">
              <div className="h-8 md:h-10 bg-[#2A2A2A] rounded animate-pulse w-64"></div>
              
              <div className="bg-ods-card border border-ods-border rounded-lg p-6 md:p-8">
                <div className="space-y-4">
                  <div className="h-6 bg-[#2A2A2A] rounded animate-pulse"></div>
                  <div className="h-6 bg-[#2A2A2A] rounded animate-pulse"></div>
                  <div className="h-6 bg-[#2A2A2A] rounded animate-pulse w-5/6"></div>
                  <div className="h-6 bg-[#2A2A2A] rounded animate-pulse w-4/5"></div>
                </div>
              </div>
            </div>

            {/* Key Features Section */}
            <div className="flex flex-col gap-6 mb-20">
              <div className="h-8 md:h-10 bg-[#2A2A2A] rounded animate-pulse w-72"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-ods-card border border-ods-border rounded-lg p-4 flex gap-4">
                    <div className="w-12 h-12 bg-[#2A2A2A] rounded flex-shrink-0 animate-pulse"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-[#2A2A2A] rounded animate-pulse w-3/4"></div>
                      <div className="h-4 bg-[#2A2A2A] rounded animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pros and Cons Section */}
            <div className="flex flex-col gap-6 mb-20">
              <div className="h-8 md:h-10 bg-[#2A2A2A] rounded animate-pulse w-80"></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pros Column */}
                <div className="flex flex-col gap-6">
                  <div className="h-5 bg-[#2A2A2A] rounded animate-pulse w-16"></div>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-ods-card border border-ods-border rounded-lg p-4 flex gap-3">
                      <div className="w-12 h-12 bg-[#161616] border border-ods-border rounded flex-shrink-0 animate-pulse"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-5 bg-[#2A2A2A] rounded animate-pulse w-2/3"></div>
                        <div className="h-4 bg-[#2A2A2A] rounded animate-pulse"></div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Cons Column */}
                <div className="flex flex-col gap-6">
                  <div className="h-5 bg-[#2A2A2A] rounded animate-pulse w-16"></div>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-ods-card border border-ods-border rounded-lg p-4 flex gap-3">
                      <div className="w-12 h-12 bg-[#161616] border border-ods-border rounded flex-shrink-0 animate-pulse"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-5 bg-[#2A2A2A] rounded animate-pulse w-2/3"></div>
                        <div className="h-4 bg-[#2A2A2A] rounded animate-pulse"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alternatives Section */}
            <div className="flex flex-col gap-6 mb-20">
              <div className="h-8 md:h-10 bg-[#2A2A2A] rounded animate-pulse w-72"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-ods-card border border-ods-border rounded-lg p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-[#161616] border border-ods-border rounded-lg animate-pulse flex-shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-6 bg-[#2A2A2A] rounded animate-pulse w-3/4"></div>
                        <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-1/2"></div>
                      </div>
                      <div className="h-6 bg-[#2A2A2A] rounded animate-pulse w-20"></div>
                    </div>
                    
                    {/* Description */}
                    <div className="space-y-2">
                      <div className="h-4 bg-[#2A2A2A] rounded animate-pulse"></div>
                      <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-5/6"></div>
                      <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-4/5"></div>
                    </div>
                    
                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-ods-border">
                      <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-16"></div>
                      <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-20"></div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Show All Button */}
              <div className="h-12 bg-[#2A2A2A] rounded-md animate-pulse"></div>
            </div>

            {/* Comments Section */}
            <div className="flex flex-col gap-6 mb-20">
              <div className="h-8 md:h-10 bg-[#2A2A2A] rounded animate-pulse w-64"></div>
              
              {/* Comment Form Skeleton */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 bg-[#161616] border border-ods-border rounded-lg overflow-hidden">
                    {/* Title Section */}
                    <div className="border-b border-ods-border p-3">
                      <div className="h-3 bg-[#2A2A2A] rounded animate-pulse w-8 mb-2"></div>
                      <div className="h-6 bg-[#2A2A2A] rounded animate-pulse w-full"></div>
                    </div>
                    
                    {/* Description Section */}
                    <div className="p-3">
                      <div className="h-3 bg-[#2A2A2A] rounded animate-pulse w-16 mb-2"></div>
                      <div className="space-y-2">
                        <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-full"></div>
                        <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-3/4"></div>
                        <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-1/2"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Send Button */}
                  <div className="flex items-stretch">
                    <div className="h-[120px] w-20 bg-[#2A2A2A] rounded-lg animate-pulse"></div>
                  </div>
                </div>
              </div>
              
              {/* Sample Comment Cards */}
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-ods-card border border-ods-border rounded-lg p-4">
                    {/* Comment Header */}
                    <div className="flex flex-col gap-3 mb-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-2">
                      <div className="flex items-center gap-2">
                        {/* User Info */}
                        <div className="flex items-center gap-2 bg-ods-card border border-ods-border rounded-lg py-2 px-3">
                          <div className="w-8 h-8 bg-[#2A2A2A] rounded-lg animate-pulse"></div>
                          <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-20"></div>
                        </div>
                        
                        {/* Timestamp */}
                        <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-12"></div>
                      </div>
                    </div>
                    
                    {/* Comment Content */}
                    <div className="space-y-2">
                      <div className="h-6 bg-[#2A2A2A] rounded animate-pulse w-2/3"></div>
                      <div className="space-y-1">
                        <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-full"></div>
                        <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-4/5"></div>
                        <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-3/5"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Desktop Only */}
          <div className="hidden lg:block w-[290px] flex-shrink-0">
            <div className="space-y-4">
              {/* Deploy Button */}
              <div className="h-12 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
              
              {/* Voting Buttons */}
              <div className="space-y-2">
                <div className="h-12 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
                <div className="h-12 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
              </div>
              
              {/* GitHub Score Section */}
              <div className="border border-ods-border rounded-lg overflow-hidden">
                {/* Header */}
                <div className="bg-ods-card p-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#2A2A2A] rounded animate-pulse"></div>
                  <div className="flex flex-col gap-1">
                    <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-20"></div>
                    <div className="h-6 bg-[#2A2A2A] rounded animate-pulse w-12"></div>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-[#2A2A2A] rounded animate-pulse"></div>
                      <div className="flex items-end gap-1">
                        <div className="h-4 bg-[#2A2A2A] rounded animate-pulse w-12"></div>
                        <div className="h-3 bg-[#2A2A2A] rounded animate-pulse w-8"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="space-y-3">
                <div className="h-12 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
                <div className="h-12 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
                <div className="h-12 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

/**
 * Stats/features section skeleton for homepage
 */
export function StatsSectionSkeleton({ 
  className,
  columns = 3 
}: PageLayoutSkeletonProps & { columns?: number }) {
  return (
    <div className={cn(
      "grid gap-6 mb-12 md:mb-16",
      columns === 3 && "grid-cols-1 md:grid-cols-3",
      columns === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
      className
    )}>
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="bg-ods-card border border-ods-border rounded-lg p-6">
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
  )
}


/**
 * Blog Card Grid Skeleton - Always displays exactly 4 blog card skeletons
 * Used for consistent blog page layout with predictable height
 */
export function BlogCardGridSkeleton({ className }: PageLayoutSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <CardSkeletonGrid 
        count={4}
        variant="blog"
        className="grid-cols-1 md:grid-cols-2"
      />
    </div>
  )
}

/**
 * Vendor Grid Skeleton - Always displays exactly 12 vendor card skeletons
 * Used for consistent vendor page layout with predictable height
 */
export function VendorGridSkeleton({ className }: PageLayoutSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <CardSkeletonGrid 
        count={12}
        variant="vendor"
        className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      />
    </div>
  )
}

/**
 * Slack Community Section Skeleton
 * Matches SlackCommunity component structure with title, channel list, and chat interface
 */
export function SlackCommunitySkeleton() {
  return (
    <section 
      className="w-full bg-[#161616] px-4 md:px-20 lg:px-20 py-12 md:py-20"
      aria-label="Slack Community Loading"
    >
      {/* Frame 651 Container */}
      <div className="w-full flex flex-col gap-4 md:gap-6">
        
        {/* Title Skeleton */}
        <div className="w-full">
          <div className="h-8 md:h-12 lg:h-14 bg-[#2A2A2A] rounded-lg animate-pulse max-w-md"></div>
        </div>

        {/* Content Area - Channel List + Chat Interface */}
        <div className="w-full flex flex-col lg:flex-row lg:justify-end lg:items-start gap-4 md:gap-6 min-w-0">
          
          {/* Channel List Skeleton */}
          <div className="w-full lg:w-[290px] lg:max-w-[290px] bg-[#161616] border border-ods-border rounded flex flex-col flex-shrink-0 overflow-hidden animate-pulse">
            <div className="p-4 space-y-4">
              {/* Header */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-[#2A2A2A] rounded w-24"></div>
                  <div className="h-3 bg-[#2A2A2A] rounded w-16"></div>
                </div>
                <div className="h-3 bg-[#2A2A2A] rounded w-32"></div>
              </div>

              {/* Channels */}
              <div className="flex flex-col gap-1">
                <div className="h-3 bg-[#2A2A2A] rounded w-16 mb-2"></div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-3 min-h-[48px]">
                    <div className="w-4 h-4 bg-[#2A2A2A] rounded"></div>
                    <div className="flex-1">
                      <div className="h-3 bg-[#2A2A2A] rounded w-24 mb-1"></div>
                      <div className="h-2 bg-[#2A2A2A] rounded w-16"></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="border-t border-ods-border pt-3 mt-2">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 bg-[#2A2A2A] rounded w-16"></div>
                    <div className="h-3 bg-[#2A2A2A] rounded w-8"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3 bg-[#2A2A2A] rounded w-20"></div>
                    <div className="h-3 bg-[#2A2A2A] rounded w-8"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Interface Skeleton */}
          <div className="flex-1 min-h-[450px] h-[450px] md:min-h-[500px] md:h-[500px] lg:min-h-[600px] lg:h-[600px] bg-ods-card border border-ods-border rounded-lg flex flex-col min-w-0 animate-pulse">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-ods-border bg-[#161616] h-[56px] md:h-[60px] flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-3 md:h-4 bg-[#2A2A2A] rounded w-3 md:w-4"></div>
                <div className="h-3 md:h-4 bg-[#2A2A2A] rounded w-24 md:w-32"></div>
              </div>
              <div className="h-3 bg-[#2A2A2A] rounded w-12 md:w-16"></div>
            </div>

            {/* Messages */}
            <div className="flex-1 bg-[#161616] p-4 md:p-6 space-y-3 md:space-y-4 overflow-hidden min-h-[280px] md:min-h-[320px] lg:min-h-[420px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-2 md:gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-[#2A2A2A] rounded-lg flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-3 bg-[#2A2A2A] rounded w-16 md:w-20"></div>
                      <div className="h-3 bg-[#2A2A2A] rounded w-12 md:w-16"></div>
                    </div>
                    <div className="h-3 md:h-4 bg-[#2A2A2A] rounded w-full"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 border-t border-ods-border bg-ods-card h-[72px] md:h-[80px] flex-shrink-0">
              <div className="flex items-end gap-3 justify-center md:justify-end">
                <div className="h-10 md:h-12 bg-[#2A2A2A] rounded-lg w-28 md:w-32"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 