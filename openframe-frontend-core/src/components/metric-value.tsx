'use client';

import { cn } from '../utils/cn';

interface MetricValueProps {
  value: string | number;
  label: string;
  className?: string;
}

/**
 * Displays a numeric/short textual value followed by a smaller grey label.
 * Example: 30s Generation Time
 */
export function MetricValue({ value, label, className }: MetricValueProps) {
  return (
    <div className={cn('flex items-end gap-2 whitespace-nowrap text-ods-text-primary text-h4', className)}>
      {value}
      <span className="text-ods-text-secondary text-h6">{label}</span>
    </div>
  );
}
