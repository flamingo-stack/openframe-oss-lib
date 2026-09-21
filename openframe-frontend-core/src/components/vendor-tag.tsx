'use client';

import { Boxes, Database, Hand, Plug, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';
import { OpenSourceIcon, CoinsIcon } from './icons-stub';
import { OpenFrameLogo } from './openframe-logo';

export interface VendorTagProps {
  type:
    | 'open-source'
    | 'commercial'
    | 'free'
    | 'freemium'
    | 'paid'
    | 'enterprise'
    | 'recommended'
    | 'classification'
    | 'ai'
    | 'manual'
    | 'openframe_selected'
    | 'placeholder'
    | 'api'
    | 'data'
    | 'k8s'
    | 'secured';
  text?: string;
  className?: string;
  size?: 'sm' | 'md';
  hidden?: boolean;
  accentColor?: string;
}

export function VendorTag({ type, text, className = '', hidden = false, size = 'md', accentColor }: VendorTagProps) {
  // Base classes for the tag container
  const baseClasses = cn(
    'flex items-center gap-1.5 whitespace-nowrap rounded border border-ods-border bg-ods-bg',
    size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5',
  );

  // Get display text and styling based on type
  const getTagContent = () => {
    switch (type) {
      case 'placeholder':
        return {
          text: 'Placeholder',
          textColor: 'text-ods-text-primary',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm">
              <Sparkles width={10} height={10} className="text-ods-text-primary" />
            </div>
          ),
        };
      case 'ai':
        return {
          text: 'AI Selected',
          textColor: 'text-ods-text-primary',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm">
              <Sparkles width={10} height={10} className="text-ods-text-primary" />
            </div>
          ),
        };
      case 'manual':
        return {
          text: 'Manually Selected',
          textColor: 'text-ods-text-secondary',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm">
              <Hand width={10} height={10} className="text-ods-text-secondary" />
            </div>
          ),
        };
      case 'open-source':
        return {
          text: text || 'Open Source',
          icon: (
            <div
              className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-accent"
              style={accentColor ? { backgroundColor: accentColor } : undefined}
            >
              <OpenSourceIcon width={10} height={10} className="text-ods-text-on-accent" />
            </div>
          ),
        };
      case 'commercial':
        return {
          text: text || 'Commercial Vendor',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-border">
              <CoinsIcon width={10} height={10} className="text-ods-text-secondary" />
            </div>
          ),
        };
      // platform-capability tags — same neutral icon-box chrome as 'commercial'
      case 'api':
        return {
          text: text || 'API',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-border">
              <Plug width={10} height={10} className="text-ods-text-secondary" />
            </div>
          ),
        };
      case 'data':
        return {
          text: text || 'Data',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-border">
              <Database width={10} height={10} className="text-ods-text-secondary" />
            </div>
          ),
        };
      case 'k8s':
        return {
          text: text || 'K8s',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-border">
              <Boxes width={10} height={10} className="text-ods-text-secondary" />
            </div>
          ),
        };
      case 'secured':
        return {
          text: text || 'Secured',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-border">
              <ShieldCheck width={10} height={10} className="text-ods-text-secondary" />
            </div>
          ),
        };
      case 'free':
        return {
          text: text || 'Free',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-accent">
              <span className="text-[8px] font-bold text-ods-text-on-accent">$</span>
            </div>
          ),
        };
      case 'freemium':
        return {
          text: text || 'Freemium',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-accent">
              <span className="text-[8px] font-bold text-ods-text-on-accent">$</span>
            </div>
          ),
        };
      case 'paid':
        return {
          text: text || 'Paid',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-border">
              <CoinsIcon width={10} height={10} className="text-ods-text-secondary" />
            </div>
          ),
        };
      case 'enterprise':
        return {
          text: text || 'Enterprise',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-accent">
              <span className="text-[8px] font-bold text-ods-text-on-accent">E</span>
            </div>
          ),
        };
      case 'recommended':
        return {
          text: text || 'Recommended',
          icon: (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-accent">
              <span className="text-[8px] font-bold text-ods-text-on-accent">★</span>
            </div>
          ),
        };
      case 'classification': {
        // Handle specific classification types based on the text value
        const classificationType = text?.toLowerCase();

        if (classificationType === 'open_source') {
          return {
            text: 'Open Source',
            icon: (
              <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-accent">
                <OpenSourceIcon width={10} height={10} className="text-ods-text-on-accent" />
              </div>
            ),
          };
        } else if (classificationType === 'commercial') {
          return {
            text: 'Commercial Vendor',
            icon: (
              <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-border">
                <CoinsIcon width={10} height={10} className="text-ods-text-secondary" />
              </div>
            ),
          };
        } else if (classificationType === 'openframe_selected') {
          return {
            text: 'OpenFrame Selected',
            icon: (
              <OpenFrameLogo
                lowerPathColor="currentColor"
                upperPathColor="currentColor"
                className="h-4 w-4 text-ods-accent"
              />
            ),
          };
        } else {
          // Fallback for unknown classification types
          return {
            text: text || 'Classification',
            icon: (
              <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-accent">
                <span className="text-[8px] font-bold text-ods-text-on-accent">C</span>
              </div>
            ),
          };
        }
      }
      case 'openframe_selected':
        return {
          text: text || 'OpenFrame Selected',
          icon: (
            <OpenFrameLogo
              lowerPathColor="currentColor"
              upperPathColor="currentColor"
              className="h-4 w-4 text-ods-accent"
            />
          ),
        };
      default:
        return {
          text: text || type,
          icon: null,
        };
    }
  };

  const { text: displayText, icon, textColor } = getTagContent();

  return (
    <div className={cn(baseClasses, className, hidden && 'invisible')}>
      {icon}
      <span className={cn('font-semibold text-h5', textColor ? textColor : 'text-ods-text-primary')}>
        {displayText}
      </span>
    </div>
  );
}
