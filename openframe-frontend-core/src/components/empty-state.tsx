'use client';

import { Search, FileText, Package } from 'lucide-react';
import { useRouter } from '../embed-shims/next-navigation';
import { Button } from './ui/button';

export interface EmptyStateProps {
  type: 'vendors' | 'posts' | 'search' | 'generic';
  title?: string;
  description?: string;
  showBackButton?: boolean;
  onGoBack?: () => void;
  backButtonText?: string;
  // New CTA properties
  showCTA?: boolean;
  ctaText?: string;
  onCtaClick?: () => void;
  /**
   * Link-CTA mode: render the CTA as a navigation link (`href` — plain or
   * `mailto:`). Wins over `onCtaClick`, and SHORT-CIRCUITS the smart-CTA
   * path-sniffing below (which reads `window.location.pathname` — an
   * SSR/client divergence server-rendered pages must never enter).
   */
  ctaHref?: string;
  ctaVariant?: 'primary' | 'secondary';
}

export function EmptyState({
  type,
  title,
  description,
  showBackButton = false,
  onGoBack,
  backButtonText = 'Go Back',
  showCTA = true,
  ctaText,
  onCtaClick,
  ctaHref,
  ctaVariant = 'primary',
}: EmptyStateProps) {
  const router = useRouter();

  // Default content based on type
  const getDefaultContent = () => {
    switch (type) {
      case 'vendors':
        return {
          icon: <Package className="h-full w-full" />,
          title: 'No vendors found',
          description:
            "We couldn't find any vendors matching your criteria. Try adjusting your filters or search terms.",
        };
      case 'posts':
        return {
          icon: <FileText className="h-full w-full" />,
          title: 'No articles found',
          description:
            "We couldn't find any articles matching your criteria. Try different categories, tags, or search terms.",
        };
      case 'search':
        return {
          icon: <Search className="h-full w-full" />,
          title: 'No results found',
          description: "Your search didn't return any results. Try different keywords or browse our categories.",
        };
      default:
        return {
          icon: <Search className="h-full w-full" />,
          title: 'Nothing found',
          description: "We couldn't find what you're looking for. Try adjusting your search or filters.",
        };
    }
  };

  // Smart CTA logic based on context
  const getSmartCTA = () => {
    // If custom CTA is provided, use it
    if (ctaText && onCtaClick) {
      return {
        text: ctaText,
        action: onCtaClick,
      };
    }

    // Check if we're on the client side
    const isClient = typeof window !== 'undefined';
    const currentPath = isClient ? window.location.pathname : '';

    // Surgical filter reset (promoted from the hub's diverged clone during
    // the EmptyState convergence): delete ONLY the filter params the surface
    // owns — nuking the whole query string threw away unrelated state — and
    // use `replace` with `scroll: false` so resetting filters neither adds a
    // history entry nor jumps the page.
    const resetParams = (paramsToDelete: string[]) => {
      if (!isClient) return;
      const params = new URLSearchParams(window.location.search);
      for (const p of paramsToDelete) params.delete(p);
      const queryString = params.toString();
      // Keep the hash — a filter reset must not clear an unrelated
      // deep-link anchor (e.g. #delivery-123).
      const hash = window.location.hash;
      router.replace(`${window.location.pathname}${queryString ? `?${queryString}` : ''}${hash}`, { scroll: false });
    };

    // Smart defaults based on type and context
    switch (type) {
      case 'search':
        return {
          text: 'Reset Filters',
          action: () => resetParams(['search', 'page']),
        };
      case 'posts':
        // Blog-style listing pages (blog, case studies) reset their filters
        if (currentPath.includes('/blog') || currentPath.includes('/case-studies')) {
          return {
            text: 'Reset Filters',
            action: () => resetParams(['search', 'page', 'category', 'tags']),
          };
        } else if (currentPath.includes('/profile')) {
          return {
            text: 'Browse Vendors',
            action: () => router.push('/vendors'),
          };
        }
        return {
          text: 'View All Posts',
          action: () => router.push('/blog'),
        };
      case 'vendors':
        // If we're in profile or other pages, direct to main content
        if (currentPath.includes('/profile')) {
          return {
            text: 'Browse Vendors',
            action: () => router.push('/vendors'),
          };
        } else if (currentPath.includes('/vendors') || currentPath.includes('/margin-increase/compare')) {
          return {
            text: 'Reset Filters',
            action: () => resetParams(['search', 'page', 'category', 'subcategory']),
          };
        }
        return {
          text: 'Browse Vendors',
          action: () => router.push('/vendors'),
        };
      default:
        return {
          text: 'Browse Vendors',
          action: () => router.push('/vendors'),
        };
    }
  };

  const defaultContent = getDefaultContent();
  const displayTitle = title || defaultContent.title;
  const displayDescription = description || defaultContent.description;
  // ctaHref short-circuits BEFORE getSmartCTA(): the smart defaults read
  // window.location.pathname (SSR-empty, client-real), so a server-rendered
  // page with a link CTA must never enter that branch. Existing callers
  // without ctaHref keep today's smart-default behavior unchanged.
  const smartCTA = ctaHref ? null : getSmartCTA();
  const ctaClassName =
    ctaVariant === 'primary'
      ? 'w-full bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent-hover transition-all duration-150 font-body font-medium'
      : 'w-full bg-transparent border border-ods-border text-ods-text-primary hover:border-ods-accent hover:text-ods-accent transition-all duration-150 font-body font-medium';

  return (
    <div className="flex flex-col items-center justify-center px-6 py-6 text-center md:py-16">
      {/* Icon */}
      <div className="mb-3 flex items-center justify-center md:mb-6">
        <div className="rounded-full border border-ods-border bg-ods-card p-3 md:p-6">
          <div className="flex h-8 w-8 items-center justify-center text-ods-text-secondary md:h-16 md:w-16">
            {defaultContent.icon}
          </div>
        </div>
      </div>

      {/* Title */}
      <h2 className="mb-2 text-ods-text-primary text-h3 md:mb-3">{displayTitle}</h2>

      {/* Description */}
      <p className="mb-4 max-w-md text-ods-text-secondary text-h6 md:mb-8">{displayDescription}</p>

      {/* Link CTA (ctaHref) — SSR-safe, no path sniffing */}
      {showCTA && ctaHref && (
        <div className="mb-3 w-full max-w-xs">
          <Button href={ctaHref} className={ctaClassName}>
            {ctaText || 'Contact us'}
          </Button>
        </div>
      )}

      {/* Smart CTA Button */}
      {showCTA && !ctaHref && smartCTA && (
        <div className="mb-3 w-full max-w-xs">
          <Button onClick={smartCTA.action} className={ctaClassName}>
            {smartCTA.text}
          </Button>
        </div>
      )}

      {/* Optional Back Button */}
      {showBackButton && onGoBack && (
        <div className="w-full max-w-xs">
          <Button
            onClick={onGoBack}
            variant="outline"
            className="w-full font-body font-medium transition-all duration-150"
          >
            {backButtonText}
          </Button>
        </div>
      )}
    </div>
  );
}
