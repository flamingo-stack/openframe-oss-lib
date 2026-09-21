'use client';

import { cn } from '../../utils/cn';
import { Chevron02DownIcon } from '../icons-v2-generated';

interface ExpandChevronProps {
  expanded: boolean;
  className?: string;
}

export function ExpandChevron({ expanded, className }: ExpandChevronProps) {
  return (
    <Chevron02DownIcon
      className={cn(
        'h-4 w-4 shrink-0 text-ods-text-secondary transition-transform duration-200',
        expanded && 'rotate-180',
        className,
      )}
    />
  );
}
