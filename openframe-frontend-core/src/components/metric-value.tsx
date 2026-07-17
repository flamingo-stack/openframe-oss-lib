"use client"

import React from 'react';
import { cn } from "../utils/cn";

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
    <div className={cn('flex items-end gap-2 whitespace-nowrap text-h4 text-ods-text-primary', className)}>
      {value}
      <span className="text-h6 text-ods-text-secondary">
        {label}
      </span>
    </div>
  );
} 