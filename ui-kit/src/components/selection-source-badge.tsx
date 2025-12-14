import React from 'react';
import { cn } from "../utils/cn";
import { VendorTag } from './vendor-tag';

export type SelectionSourceType = 'ai' | 'manual' | 'placeholder';

interface SelectionSourceBadgeProps {
  source: SelectionSourceType;
  className?: string;
  hidden?: boolean;
}

/**
 * Small pill badge indicating whether a vendor was selected manually or by AI.
 * Colors follow OpenMSP design tokens.
 */
export function SelectionSourceBadge({ source, hidden = false }: SelectionSourceBadgeProps) {
  if (!source) {
    return null;
  }
  
  return (
    <VendorTag
      key={`source-${source}`}
      type={source?.toLowerCase() as 'ai' | 'manual' | 'placeholder'}
      size="sm"
      hidden={hidden}
    />
  );
} 