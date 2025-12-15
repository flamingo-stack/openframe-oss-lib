import { Suspense } from "react"
import { Skeleton } from "./ui/skeleton"
import { SocialIconRow } from "./social-icon-row"

interface FooterLink {
  href: string
  label: string
}

interface FooterSection {
  title: string
  links: FooterLink[]
}

interface FooterConfig {
  name: string
  legalName: string
  description: string
  logo?: React.ReactNode
  sections: FooterSection[]
  customComponent?: React.ReactNode  // Inject any custom component here
  nameElement?: React.ReactNode  // Custom element for platform name with specific font
  hideSocialRow?: boolean  // Hide the default social row
  rightColumnContent?: React.ReactNode  // Custom content for right column
  belowDescriptionContent?: React.ReactNode  // Custom content below description
  moveDescriptionToRight?: boolean  // Move description and belowDescriptionContent to right column
  keepBelowDescriptionLeft?: boolean  // Keep belowDescriptionContent on left even when moveDescriptionToRight is true
  backgroundColor?: string  // ODS background color (e.g., 'bg-ods-bg-card', 'bg-ods-system-greys-black')
  social?: {
    github?: string
    twitter?: string
    linkedin?: string
    reddit?: string
    youtube?: string
    instagram?: string
    facebook?: string
    discord?: string
    telegram?: string
    whatsapp?: string
  }
}

interface FooterProps {
  config?: FooterConfig
  renderLink?: (link: FooterLink) => React.ReactNode
}

function NavLinkSkeleton() {
  return <Skeleton className="h-5 md:h-6 w-20 md:w-24" />
}

/**
 * Platform-Aware Footer Component
 * Accepts configuration from app-config.ts
 */
export function Footer({ config, renderLink }: FooterProps) {
  // Config is required - no hardcoded fallbacks
  if (!config) {
    console.warn('Footer: No config provided')
    return null
  }
  
  return <UniversalFooter config={config} renderLink={renderLink} />
}

/**
 * Universal Footer Component
 * Renders footer based on provided config
 */
function UniversalFooter({ config, renderLink }: { config: FooterConfig; renderLink?: (link: FooterLink) => React.ReactNode }) {
  const defaultRenderLink = (link: FooterLink) => (
    <a href={link.href} className="font-body font-medium text-md md:text-md leading-[1.33] text-ods-text-primary hover:text-ods-accent-primary transition-colors">
      {link.label}
    </a>
  )
  
  const linkRenderer = renderLink || defaultRenderLink
  
  return (
    <footer className={`w-full flex flex-col justify-center items-center ${config.backgroundColor || 'bg-ods-bg-card'} px-6 py-10 relative gap-6 md:gap-6 min-h-[auto] md:min-h-[248px] z-50 border-t border-ods-border`}>
      <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 items-start">
        
        {/* Column 1: Logo and optionally description */}
        <div className="flex flex-col gap-4 md:gap-6 items-start text-left col-span-2 md:col-span-1 lg:col-span-1">
          {/* Logo and name */}
          <div className="flex items-center gap-2">
            {config.logo && (
              <Suspense fallback={<Skeleton className="w-8 h-8" />}>
                {config.logo as any}
              </Suspense>
            )}
            {config.nameElement || <span className="font-heading text-heading-5 font-bold text-ods-text-primary whitespace-nowrap">{config.name}</span>}
          </div>
          
          {/* Only show description here if NOT moving to right */}
          {!config.moveDescriptionToRight && (
            <>
              <p className="font-body font-medium text-sm md:text-sm leading-[1.43] text-ods-text-primary">
                {config.description}
              </p>
              
              {/* Custom content below description */}
              {config.belowDescriptionContent && (
                <Suspense fallback={<Skeleton className="h-8 w-full" />}>
                  {config.belowDescriptionContent as any}
                </Suspense>
              )}
              
              {/* Conditional social row - show by default unless hideSocialRow is true */}
              {!config.hideSocialRow && (
                <SocialIconRow
                  className="pt-2"
                  links={config.social ? Object.entries(config.social)
                    .filter(([_, href]) => href)
                    .map(([platform, href]) => ({ platform, href: href as string }))
                    : undefined
                  }
                />
              )}
            </>
          )}
          
          {/* Show belowDescriptionContent on left even when description is moved to right */}
          {config.moveDescriptionToRight && config.keepBelowDescriptionLeft && config.belowDescriptionContent && (
            <Suspense fallback={<Skeleton className="h-8 w-full" />}>
              {config.belowDescriptionContent as any}
            </Suspense>
          )}
        </div>
        
        {/* Dynamic sections - 1 column each on all screens */}
        {config.sections.map((section, index) => (
          <div key={index} className="flex flex-col gap-3 items-start text-left col-span-1">
            <h3 className="font-heading font-semibold text-sm leading-[1.43] uppercase tracking-[-0.02em] text-ods-text-muted">
              {section.title}
            </h3>
            <div className="flex flex-col gap-3">
              {section.links.map((link, linkIndex) => (
                <Suspense key={linkIndex} fallback={<NavLinkSkeleton />}>
                  {linkRenderer(link) as any}
                </Suspense>
              ))}
            </div>
          </div>
        ))}
        
        {/* Custom component column - full width on mobile and medium, 1 column on large */}
        {config.customComponent && (
          <div className="flex flex-col col-span-2 md:col-span-1 lg:col-span-1 justify-center">
            <Suspense fallback={<Skeleton className="h-32 w-full" />}>
              {config.customComponent as any}
            </Suspense>
          </div>
        )}
        
        {/* Right column content - shows if rightColumnContent is provided OR if moving description to right */}
        {(config.rightColumnContent || config.moveDescriptionToRight) && (
          <div className="flex flex-col col-span-2 md:col-span-1 lg:col-span-1 justify-start gap-4 md:gap-6">
            {/* Show description in right column if moveDescriptionToRight is true */}
            {config.moveDescriptionToRight && (
              <>
                <p className="font-body font-medium text-sm md:text-sm leading-[1.43] text-ods-text-primary">
                  {config.description}
                </p>
                
                {/* Custom content below description - only if NOT keeping it on left */}
                {config.belowDescriptionContent && !config.keepBelowDescriptionLeft && (
                  <Suspense fallback={<Skeleton className="h-8 w-full" />}>
                    {config.belowDescriptionContent as any}
                  </Suspense>
                )}
              </>
            )}
            
            {/* Regular right column content */}
            {config.rightColumnContent && (
              <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                {config.rightColumnContent as any}
              </Suspense>
            )}
          </div>
        )}
      </div>
      
      {/* Copyright */}
      <p className="font-body font-medium text-md md:text-md leading-[1.33] text-center w-full text-ods-text-muted pt-4 md:pt-0">
        © {new Date().getFullYear()} {config.legalName}. All rights reserved.
      </p>
    </footer>
  )
}

