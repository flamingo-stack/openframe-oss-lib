'use client';

import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { SocialIconRow } from './social-icon-row';
import { Skeleton } from './ui/skeleton';

interface FooterLink {
  href: string;
  label: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

interface FooterConfig {
  name: string;
  legalName: string;
  description: string;
  logo?: ReactNode;
  sections: FooterSection[];
  customComponent?: ReactNode; // Inject any custom component here
  nameElement?: ReactNode; // Custom element for platform name with specific font
  hideSocialRow?: boolean; // Hide the default social row
  rightColumnContent?: ReactNode; // Custom content for right column
  belowDescriptionContent?: ReactNode; // Custom content below description
  moveDescriptionToRight?: boolean; // Move description and belowDescriptionContent to right column
  keepBelowDescriptionLeft?: boolean; // Keep belowDescriptionContent on left even when moveDescriptionToRight is true
  backgroundColor?: string; // ODS background color (e.g., 'bg-ods-card', 'bg-ods-bg')
  social?: {
    github?: string;
    twitter?: string;
    linkedin?: string;
    reddit?: string;
    youtube?: string;
    instagram?: string;
    facebook?: string;
    discord?: string;
    telegram?: string;
    whatsapp?: string;
  };
}

interface FooterProps {
  config?: FooterConfig;
  renderLink?: (link: FooterLink) => ReactNode;
}

function NavLinkSkeleton() {
  return <Skeleton className="h-5 w-20 md:h-6 md:w-24" />;
}

/**
 * Platform-Aware Footer Component
 * Accepts configuration from app-config.ts
 */
export function Footer({ config, renderLink }: FooterProps) {
  // Config is required - no hardcoded fallbacks
  if (!config) {
    console.warn('Footer: No config provided');
    return null;
  }

  return <UniversalFooter config={config} renderLink={renderLink} />;
}

/**
 * Universal Footer Component
 * Renders footer based on provided config
 */
function UniversalFooter({
  config,
  renderLink,
}: {
  config: FooterConfig;
  renderLink?: (link: FooterLink) => ReactNode;
}) {
  const defaultRenderLink = (link: FooterLink) => (
    <a
      href={link.href}
      className="text-md md:text-md font-body font-medium leading-[1.33] text-ods-text-primary transition-colors hover:text-ods-accent"
    >
      {link.label}
    </a>
  );

  const linkRenderer = renderLink || defaultRenderLink;

  return (
    <footer
      className={`flex w-full flex-col items-center justify-center ${config.backgroundColor || 'bg-ods-card'} relative z-[44] min-h-[auto] gap-6 border-t border-ods-border px-6 py-10 md:min-h-[248px] md:gap-6`}
    >
      <div className="grid w-full grid-cols-2 items-start gap-6 md:gap-8 lg:grid-cols-4">
        {/* Column 1: Logo and optionally description */}
        <div className="col-span-2 flex flex-col items-start gap-4 text-left md:col-span-1 md:gap-6 lg:col-span-1">
          {/* Logo and name */}
          <div className="flex items-center gap-2">
            {config.logo && <Suspense fallback={<Skeleton className="h-8 w-8" />}>{config.logo}</Suspense>}
            {config.nameElement || (
              <span className="whitespace-nowrap font-heading text-heading-5 font-bold text-ods-text-primary">
                {config.name}
              </span>
            )}
          </div>

          {/* Only show description here if NOT moving to right */}
          {!config.moveDescriptionToRight && (
            <>
              <p className="font-body text-sm font-medium leading-[1.43] text-ods-text-primary md:text-sm">
                {config.description}
              </p>

              {/* Custom content below description */}
              {config.belowDescriptionContent && (
                <Suspense fallback={<Skeleton className="h-8 w-full" />}>{config.belowDescriptionContent}</Suspense>
              )}

              {/* Conditional social row - show by default unless hideSocialRow is true */}
              {!config.hideSocialRow && (
                <SocialIconRow
                  className="pt-2"
                  links={
                    config.social
                      ? Object.entries(config.social)
                          .filter(([_, href]) => href)
                          .map(([platform, href]) => ({ platform, href: href }))
                      : undefined
                  }
                />
              )}
            </>
          )}

          {/* Show belowDescriptionContent on left even when description is moved to right */}
          {config.moveDescriptionToRight && config.keepBelowDescriptionLeft && config.belowDescriptionContent && (
            <Suspense fallback={<Skeleton className="h-8 w-full" />}>{config.belowDescriptionContent}</Suspense>
          )}
        </div>

        {/* Dynamic sections - 1 column each on all screens */}
        {config.sections.map((section, index) => (
          <div key={index} className="col-span-1 flex flex-col items-start gap-3 text-left">
            <h3 className="tracking-[-0.02em] text-ods-text-muted text-h5">{section.title}</h3>
            <div className="flex flex-col gap-3">
              {section.links.map((link, linkIndex) => (
                <Suspense key={linkIndex} fallback={<NavLinkSkeleton />}>
                  {linkRenderer(link)}
                </Suspense>
              ))}
            </div>
          </div>
        ))}

        {/* Custom component column - full width on mobile and medium, 1 column on large */}
        {config.customComponent && (
          <div className="col-span-2 flex flex-col justify-center md:col-span-1 lg:col-span-1">
            <Suspense fallback={<Skeleton className="h-32 w-full" />}>{config.customComponent}</Suspense>
          </div>
        )}

        {/* Right column content - shows if rightColumnContent is provided OR if moving description to right */}
        {(config.rightColumnContent || config.moveDescriptionToRight) && (
          <div className="col-span-2 flex flex-col justify-start gap-4 md:col-span-1 md:gap-6 lg:col-span-1">
            {/* Show description in right column if moveDescriptionToRight is true */}
            {config.moveDescriptionToRight && (
              <>
                <p className="font-body text-sm font-medium leading-[1.43] text-ods-text-primary md:text-sm">
                  {config.description}
                </p>

                {/* Custom content below description - only if NOT keeping it on left */}
                {config.belowDescriptionContent && !config.keepBelowDescriptionLeft && (
                  <Suspense fallback={<Skeleton className="h-8 w-full" />}>{config.belowDescriptionContent}</Suspense>
                )}
              </>
            )}

            {/* Regular right column content */}
            {config.rightColumnContent && (
              <Suspense fallback={<Skeleton className="h-32 w-full" />}>{config.rightColumnContent}</Suspense>
            )}
          </div>
        )}
      </div>

      {/* Copyright */}
      <p className="text-md md:text-md w-full pt-4 text-center font-body font-medium leading-[1.33] text-ods-text-muted md:pt-0">
        © {new Date().getFullYear()} {config.legalName}. All rights reserved.
      </p>
    </footer>
  );
}
