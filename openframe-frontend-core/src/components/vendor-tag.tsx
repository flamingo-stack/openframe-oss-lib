'use client';

import { Boxes, Database, DollarSign, Hand, Plug, ShieldCheck, Sparkles } from 'lucide-react';
import { createElement, type ReactNode } from 'react';
import { cn } from '../utils/cn';
import { formatClassification } from '../utils/format';
import { type VendorClassificationIconConfig, vendorClassificationCopy } from '../utils/vendor-classification';
import { resolveIcon } from './chat/utils/icon-library';

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

const TONE_CLASS: Readonly<Record<VendorClassificationIconConfig['tone'], string>> = {
  accent: 'text-ods-text-on-accent',
  neutral: 'text-ods-text-secondary',
  warning: 'text-ods-warning',
};

/**
 * A classification's icon, from its config (`VENDOR_CLASSIFICATION_COPY[value].icon`): the
 * icon is resolved by NAME through the shared resolver, never imported here. A license icon
 * sits on a small tile (the accent tile for an `accent` tone); an OpenFrame mark and a
 * lifecycle icon are drawn bare in their tone. A value with no icon draws nothing.
 */
export function VendorClassificationIcon({
  classification,
  accentColor,
  className,
}: {
  classification: string;
  /** The accent tile's colour, for a host that tints its hover accent (a vendor card). */
  accentColor?: string;
  className?: string;
}) {
  const copy = vendorClassificationCopy(classification);
  if (!copy?.icon) return null;
  // The resolver returns one component per name, loaded on demand (drawn through `createElement`, as `NamedIcon` does).
  const icon = resolveIcon(copy.icon.name);
  if (copy.group !== 'license') {
    const bareClass = copy.icon.tone === 'accent' ? 'text-ods-accent' : TONE_CLASS[copy.icon.tone];
    return createElement(icon, {
      size: copy.group === 'openframe' ? 16 : 12,
      className: cn('shrink-0', bareClass, className),
    });
  }
  const accent = copy.icon.tone === 'accent';
  return (
    <div
      className={cn(
        'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm',
        accent ? 'bg-ods-accent' : 'bg-ods-border',
        className,
      )}
      style={accent && accentColor ? { backgroundColor: accentColor } : undefined}
    >
      {createElement(icon, { size: 10, className: TONE_CLASS[copy.icon.tone] })}
    </div>
  );
}

/**
 * A classification tag, derived from the value the server sends and its config: the label
 * (an OpenFrame value's one word), the configured icon, and the warning text colour for a
 * lifecycle value. Any other value is its title-cased label with no icon.
 */
function classificationTag(
  value: string,
  text?: string,
  accentColor?: string,
): { text: string; icon: ReactNode; textColor?: string } {
  const copy = vendorClassificationCopy(value);
  return {
    text: text || (copy?.group === 'openframe' ? copy.word : undefined) || copy?.label || formatClassification(value),
    textColor: copy?.group === 'lifecycle' ? 'text-ods-warning' : undefined,
    icon: <VendorClassificationIcon classification={value} accentColor={accentColor} />,
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
        return classificationTag((text ?? '').toLowerCase(), undefined, accentColor);
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
