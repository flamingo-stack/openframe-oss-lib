'use client';

import { AlertTriangle, Boxes, Clock, Code, Database, DollarSign, FileCode, Hand, type LucideIcon, PauseCircle, Plug, ShieldCheck, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../utils/cn';
import { formatClassification } from '../utils/format';
import { vendorClassificationCopy } from '../utils/vendor-classification';
import { OpenframeLogoIcon } from './icons-v2-generated/logos/openframe-logo-icon';

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
    | 'openframe_connect'
    | 'openframe_shipped'
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

/**
 * The icon of a classification we present specially. Any other classification the server
 * sends is still a tag: its label (curated, else title case) with no icon.
 */
const CLASSIFICATION_ICONS: Readonly<Record<string, { Icon: LucideIcon; tile: string; iconClass: string }>> = {
  open_source: { Icon: Code, tile: 'bg-ods-accent', iconClass: 'text-ods-text-on-accent' },
  commercial: { Icon: DollarSign, tile: 'bg-ods-border', iconClass: 'text-ods-text-secondary' },
  source_available: { Icon: FileCode, tile: 'bg-ods-border', iconClass: 'text-ods-text-secondary' },
  end_of_life: { Icon: AlertTriangle, tile: '', iconClass: 'text-ods-warning' },
  end_of_support: { Icon: Clock, tile: '', iconClass: 'text-ods-warning' },
  unmaintained: { Icon: PauseCircle, tile: '', iconClass: 'text-ods-warning' },
};

/**
 * A classification tag, derived from the value the server sends. An OpenFrame value is the
 * OpenFrame mark and its one word; a lifecycle value reads in the warning colour; an
 * enriched value carries its icon; any other value is its title-cased label.
 */
function classificationTag(value: string, text?: string, accentColor?: string): { text: string; icon: ReactNode; textColor?: string } {
  const copy = vendorClassificationCopy(value);
  if (copy?.group === 'openframe') {
    return {
      text: text || copy.word || copy.label,
      textColor: undefined,
      icon: <OpenframeLogoIcon secondaryColor="currentColor" color="currentColor" className="h-4 w-4 text-ods-accent" />,
    };
  }
  const enriched = CLASSIFICATION_ICONS[value];
  const accentTile = value === 'open_source' && accentColor ? { backgroundColor: accentColor } : undefined;
  return {
    text: text || copy?.label || formatClassification(value),
    textColor: copy?.group === 'lifecycle' ? 'text-ods-warning' : undefined,
    icon: enriched ? (
      <div
        className={cn('flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm', enriched.tile)}
        style={accentTile}
      >
        <enriched.Icon width={10} height={10} className={enriched.iconClass} />
      </div>
    ) : null,
  };
}

export function VendorTag({ type, text, className = '', hidden = false, size = 'md', accentColor }: VendorTagProps) {
  // Base classes for the tag container
  const baseClasses = cn(
    'flex items-center gap-1.5 whitespace-nowrap rounded border border-ods-border bg-ods-bg',
    size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5',
  );

  // Get display text and styling based on type
  const getTagContent = (): { text: string; icon: ReactNode; textColor?: string } => {
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
        return classificationTag('open_source', text, accentColor);
      case 'commercial':
        return classificationTag('commercial', text);
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
              <DollarSign width={10} height={10} className="text-ods-text-secondary" />
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
      case 'classification':
        return classificationTag((text ?? '').toLowerCase());
      case 'openframe_selected':
      case 'openframe_connect':
      case 'openframe_shipped':
        return classificationTag(type, text);
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
