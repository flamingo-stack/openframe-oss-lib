'use client';

import { Field } from '../ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface HighlightConfigSectionProps {
  /** Current target duration in seconds */
  targetDurationSeconds: number;
  /** Callback when target duration changes */
  onTargetDurationChange: (seconds: number) => void;
  /** Whether the section is disabled */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * HighlightConfigSection - Unified component for highlight video configuration
 *
 * This component provides a consistent UI for both CustomerInterview and ProductRelease entities,
 * including duration selection in a styled horizontal layout. Highlight captions
 * are generated automatically as a selectable text track (same pattern as the
 * main video) — there is no subtitle-burning option anymore.
 */
export function HighlightConfigSection({
  targetDurationSeconds,
  onTargetDurationChange,
  disabled = false,
  className = '',
}: HighlightConfigSectionProps) {
  return (
    <div className={`space-y-3 rounded-lg border border-ods-border bg-ods-card p-4 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          {/* Field, not a raw Label + margin hack — same label system as every
              other form field so adjacent columns stay on one baseline. */}
          <Field label="Target Duration">
            {f => (
              <Select
                value={targetDurationSeconds.toString()}
                onValueChange={value => onTargetDurationChange(parseInt(value))}
                disabled={disabled}
              >
                <SelectTrigger id={f.id} className="bg-ods-bg">
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
            )}
          </Field>
        </div>
      </div>
    </div>
  );
}

export default HighlightConfigSection;
