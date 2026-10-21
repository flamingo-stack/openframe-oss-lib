'use client';

import { cn } from '../utils/cn';
import { TextLineSkeleton } from './loading/unified-skeleton';
import { useLoadingScope } from './ui/loading-scope';

interface MetricValueProps {
  value: string | number;
  label: string;
  className?: string;
}

/** The value's layout, read by the value and by its skeleton, so the skeleton is the value's size. */
const METRIC_VALUE_CLASS = 'flex items-end gap-2 whitespace-nowrap text-ods-text-primary text-h4';
const METRIC_LABEL_CLASS = 'text-ods-text-secondary text-h6';

/**
 * Displays a numeric/short textual value followed by a smaller grey label.
 * Example: 30s Generation Time
 */
export function MetricValue({ value, label, className }: MetricValueProps) {
  if (useLoadingScope()) return <MetricValueSkeleton label={label} className={className} />;
  return (
    <div className={cn(METRIC_VALUE_CLASS, className)}>
      {value}
      <span className={METRIC_LABEL_CLASS}>{label}</span>
    </div>
  );
}

/** A value while it is read: a bar at the value's type step, the label (the page's own words) drawn as it is. */
export function MetricValueSkeleton({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn(METRIC_VALUE_CLASS, className)}>
      <TextLineSkeleton type="h4" className="w-10" />
      <span className={METRIC_LABEL_CLASS}>{label}</span>
    </div>
  );
}
