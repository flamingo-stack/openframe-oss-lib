'use client';

import { type CSSProperties, type ForwardedRef, type ReactNode, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon';

export interface HiddenTagItem {
  label: ReactNode;
  value: unknown;
}

export interface HiddenTagsPopupProps {
  items: HiddenTagItem[];
  onRemove?: (value: unknown) => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const HiddenTagsPopup = forwardRef(function HiddenTagsPopupImpl(
  { items, onRemove, disabled, className, style }: HiddenTagsPopupProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        // Base positioning is neutral (left-anchored); consumers override via
        // `style.left` (search-input, tag-search-input) or `className` (autocomplete).
        'absolute left-0 top-full z-50 mt-1 min-w-[200px]',
        'rounded-[6px] border border-ods-border bg-ods-card shadow-lg',
        'duration-150 animate-in fade-in-0 zoom-in-95',
        className,
      )}
    >
      {items.map(item => (
        <div
          key={String(item.value)}
          className={cn(
            'flex h-11 items-center justify-between gap-3 px-3 md:h-12',
            'border-b border-ods-border last:border-b-0',
          )}
        >
          <span
            className="min-w-0 flex-1 truncate uppercase text-ods-text-primary text-h5"
            title={typeof item.label === 'string' ? item.label : undefined}
          >
            {item.label}
          </span>
          {!disabled && onRemove && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onRemove(item.value);
              }}
              className="shrink-0 text-ods-text-secondary transition-colors hover:text-ods-text-primary"
              aria-label={`Remove ${String(item.label)}`}
            >
              <XmarkCircleIcon size={20} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
});
HiddenTagsPopup.displayName = 'HiddenTagsPopup';
