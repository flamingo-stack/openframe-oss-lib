'use client';

import Link from '../../embed-shims/next-link';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

/** The indicator's row and dot, read by the indicator and by its skeleton. */
const ROW_CLASS = 'flex items-center gap-1.5';
const DOT_CLASS = 'h-3 w-3 rounded-full';

interface StatusIndicatorProps {
  status: 'success' | 'pending' | 'error' | 'missing';
  label: string;
  href?: string;
}

export function StatusIndicator({ status, label, href }: StatusIndicatorProps) {
  // In a page's loading state the status is read: the indicator is its skeleton.
  if (useLoadingScope()) return <StatusIndicatorSkeleton />;
  const getStatusColor = (kind: string) => {
    switch (kind) {
      case 'success':
        return 'bg-ods-success text-ods-success';
      case 'pending':
        return 'bg-ods-warning text-ods-warning';
      case 'error':
        return 'bg-ods-error text-ods-error';
      case 'missing':
        return 'bg-ods-warning text-ods-warning';
      default:
        return 'bg-ods-text-muted text-ods-text-muted';
    }
  };

  const colorClasses = getStatusColor(status);
  const [dotColor, textColor] = colorClasses.split(' ');

  const content = (
    <div className={ROW_CLASS}>
      <div className={`${DOT_CLASS} ${dotColor}`} />
      <span className={`text-h6 ${textColor}`}>{label}</span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} target="_blank" rel="noopener noreferrer" className="cursor-pointer hover:underline">
        {content}
      </Link>
    );
  }

  return content;
}

/** A StatusIndicator while its status is read: the dot a circle of its size, the label a `text-h6` bar. */
export function StatusIndicatorSkeleton({ className }: { className?: string }) {
  return (
    <div className={`${ROW_CLASS} ${className ?? ''}`} aria-hidden>
      <UnifiedSkeleton variant="circular" className={DOT_CLASS} />
      <TextLineSkeleton type="h6" className="w-24" />
    </div>
  );
}
