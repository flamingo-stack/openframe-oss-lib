import React from 'react';
import { cn } from '../../utils/cn';

// Base container sizes for different embed types
export const EMBED_SIZES = {
  youtube: 'max-w-3xl',    // 768px - Video content needs more space
  twitter: 'max-w-md',     // 448px - Narrow tweets, mobile-first
  reddit: 'max-w-xl',      // 576px - Medium width for discussion threads
  linkedin: 'max-w-lg',    // 512px - LinkedIn post embed, mobile-first
  linkPreview: 'max-w-lg'  // 512px - Balanced width for cards
} as const;

export type EmbedSize = keyof typeof EMBED_SIZES;

interface EmbedContainerProps {
  size: EmbedSize;
  children: React.ReactNode;
  className?: string;
}

// Base container for all embeds
export function EmbedContainer({
  size,
  children,
  className = ""
}: EmbedContainerProps) {
  return (
    <div className={cn(
      "mx-auto rounded-lg overflow-hidden",
      "bg-ods-card border border-ods-border",
      "transition-all duration-200 ease-in-out",
      "hover:border-ods-accent/30 hover:shadow-lg hover:shadow-ods-accent/10",
      EMBED_SIZES[size],
      className
    )}>
      {children}
    </div>
  );
}

// Specific containers for each platform
export function YouTubeContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <EmbedContainer size="youtube" className={cn("my-6", className)}>
      {children}
    </EmbedContainer>
  );
}

export function TwitterContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <EmbedContainer size="twitter" className={cn("my-6", className)}>
      {children}
    </EmbedContainer>
  );
}

export function RedditContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <EmbedContainer size="reddit" className={cn("my-6", className)}>
      {children}
    </EmbedContainer>
  );
}

export function LinkPreviewContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <EmbedContainer size="linkPreview" className={cn("my-6", className)}>
      {children}
    </EmbedContainer>
  );
}

export function LinkedInContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <EmbedContainer size="linkedin" className={cn("my-6", className)}>
      {children}
    </EmbedContainer>
  );
}
