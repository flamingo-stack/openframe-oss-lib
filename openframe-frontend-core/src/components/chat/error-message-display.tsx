'use client';

import { forwardRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { AlertCircleIcon } from '../icons-v2-generated';
import { useChatAppearance } from './chat-appearance-context';
import { ExpandChevron } from './expand-chevron';
import { useCollapsible } from './hooks/use-collapsible';
import type { ErrorMessageDisplayProps } from './types';
import { CHAT_APPEARANCE } from './types/chat.types';

const iconTint = {
  error: 'text-ods-error',
  warning: 'text-ods-warning',
  info: 'text-ods-text-secondary',
} as const;

const ErrorMessageDisplay = forwardRef<HTMLDivElement, ErrorMessageDisplayProps>(
  ({ className, title, details, type = 'error', ...props }, ref) => {
    const [expanded, setExpanded] = useState(false);
    const { innerRef, containerStyle } = useCollapsible({ expanded });
    const hasDetails = Boolean(details);
    // v2 (fae chat `chat-info-block`): outlined on the page surface, the title
    // always reads as a heading, and the row spacing comes from the thread.
    const isV2 = useChatAppearance() === CHAT_APPEARANCE.V2;

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-md',
          isV2
            ? 'border border-ods-border bg-ods-bg p-[var(--spacing-system-xs)]'
            : 'mb-[var(--spacing-system-xsf)] bg-ods-card p-[var(--spacing-system-xsf)]',
          className,
        )}
        {...props}
      >
        <button
          type="button"
          onClick={hasDetails ? () => setExpanded(prev => !prev) : undefined}
          aria-expanded={hasDetails ? expanded : undefined}
          aria-label={hasDetails ? (expanded ? 'Collapse details' : 'Expand details') : undefined}
          disabled={!hasDetails}
          className={cn(
            'flex w-full items-center gap-[var(--spacing-system-xsf)] text-left',
            hasDetails ? 'cursor-pointer' : 'cursor-default',
          )}
        >
          <AlertCircleIcon size={16} className={cn('shrink-0', iconTint[type])} />
          <span
            className={cn(
              'min-w-0 flex-1 text-h5',
              expanded || isV2 ? 'text-ods-text-primary' : 'text-ods-text-secondary',
              !expanded && 'truncate',
            )}
          >
            {title}
          </span>
          {hasDetails && <ExpandChevron expanded={expanded} />}
        </button>

        {hasDetails && (
          <div style={containerStyle}>
            <div
              ref={innerRef}
              className={cn(
                'px-[var(--spacing-system-lf)]',
                isV2 ? 'pt-[var(--spacing-system-xs)]' : 'pt-[var(--spacing-system-xsf)]',
              )}
            >
              <p className="text-ods-text-primary text-h6">{details}</p>
            </div>
          </div>
        )}
      </div>
    );
  },
);

ErrorMessageDisplay.displayName = 'ErrorMessageDisplay';

export { ErrorMessageDisplay };
