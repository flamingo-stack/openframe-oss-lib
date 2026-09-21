import React from 'react';

import { cn } from '../../../utils/cn';
import { noDataIconClasses } from './no-data-styles';

interface NoDataMessageProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Leading glyph, sized to 16px (mobile) / 24px (md+). Optional. */
  icon?: React.ReactNode;
  /** Primary line (body size). */
  title?: React.ReactNode;
  /** Secondary line (caption size). */
  description?: React.ReactNode;
}

/**
 * A transparent, centered stack of an icon, a title and a description, in muted
 * gray. Any piece is optional, so it also covers "icon + title", "title only",
 * and similar reduced forms.
 */
const NoDataMessage = React.forwardRef<HTMLDivElement, NoDataMessageProps>(function NoDataMessageImpl(
  { icon, title, description, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center gap-[var(--spacing-system-l)] text-center text-ods-text-secondary',
        className,
      )}
      {...props}
    >
      {icon && <span className={noDataIconClasses}>{icon}</span>}
      {(title || description) && (
        <div className="flex flex-col">
          {title && <p className="break-words text-h4">{title}</p>}
          {description && <p className="break-words text-h6">{description}</p>}
        </div>
      )}
    </div>
  );
});
NoDataMessage.displayName = 'NoDataMessage';

export { NoDataMessage, type NoDataMessageProps };
