"use client";

import React from 'react';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface HighlightConfigSectionProps {
  /** Current target duration in seconds */
  targetDurationSeconds: number;
  /** Callback when target duration changes */
  onTargetDurationChange: (seconds: number) => void;
  /** Whether to skip subtitle burning */
  skipSubtitleBurning: boolean;
  /** Callback when skip subtitle option changes */
  onSkipSubtitleBurningChange: (skip: boolean) => void;
  /** Whether the section is disabled */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * HighlightConfigSection - Unified component for highlight video configuration
 *
 * This component provides a consistent UI for both CustomerInterview and ProductRelease entities,
 * including duration selection and subtitle burning options in a styled horizontal layout.
 */
export function HighlightConfigSection({
  targetDurationSeconds,
  onTargetDurationChange,
  skipSubtitleBurning,
  onSkipSubtitleBurningChange,
  disabled = false,
  className = '',
}: HighlightConfigSectionProps) {
  return (
    <div className={`space-y-3 p-4 bg-[#1a1a1a] rounded-lg border border-ods-border ${className}`}>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label className="text-sm">Target Duration</Label>
          <Select
            value={targetDurationSeconds.toString()}
            onValueChange={(value) => onTargetDurationChange(parseInt(value))}
            disabled={disabled}
          >
            <SelectTrigger className="bg-[#161616] mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-ods-card">
              <SelectItem value="60">1 minute</SelectItem>
              <SelectItem value="120">2 minutes</SelectItem>
              <SelectItem value="180">3 minutes (Recommended)</SelectItem>
              <SelectItem value="240">4 minutes</SelectItem>
              <SelectItem value="300">5 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            id="skipSubtitleBurning"
            checked={skipSubtitleBurning}
            onChange={(e) => onSkipSubtitleBurningChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-ods-border bg-[#161616] text-ods-accent focus:ring-ods-accent"
          />
          <Label htmlFor="skipSubtitleBurning" className="text-sm cursor-pointer">
            Skip subtitle burning
          </Label>
        </div>
      </div>
    </div>
  );
}

export default HighlightConfigSection;
