'use client';

import { StandardCcIcon } from '../icons-v2-generated';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

export interface SubtitlesEditorProps {
  /** SRT subtitle content */
  subtitles?: string;
  /** Callback when subtitles change */
  onSubtitlesChange?: (value: string) => void;
  /** Custom label for subtitles field */
  label?: string;
  /** Custom helper text */
  helperText?: string;
  /** Custom placeholder */
  placeholder?: string;
  /** Minimum height for the textarea */
  minHeight?: number;
  /** Show the AI Generated badge next to the label (when content exists) */
  isAIGenerated?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** DOM id for the textarea/label pair (unique per instance on a page) */
  id?: string;
  /** Additional class name */
  className?: string;
}

/**
 * SubtitlesEditor — THE single SRT-editing surface.
 *
 * Extracted from TranscriptSummaryEditor so the MAIN video's subtitles
 * (srt_content) and the HIGHLIGHT reel's subtitles (highlight_srt_content)
 * render through the exact same component: same textarea, same AI badge,
 * same helper-text layout. Renders nothing when neither content nor a
 * change handler is provided (same convention the inline block had).
 */
export function SubtitlesEditor({
  subtitles,
  onSubtitlesChange,
  label = 'Subtitles (SRT)',
  helperText = 'SRT subtitle content generated from transcription. Editable for fine-tuning.',
  placeholder = '1\n00:00:00,000 --> 00:00:02,500\nHello, welcome to...',
  minHeight = 200,
  isAIGenerated = false,
  disabled = false,
  id = 'subtitles',
  className = '',
}: SubtitlesEditorProps) {
  if (!subtitles && !onSubtitlesChange) return null;

  return (
    <div className={className}>
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={id}>{label}</Label>
          {isAIGenerated && subtitles && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <StandardCcIcon size={12} />
              AI Generated
            </Badge>
          )}
        </div>
        <p className="mt-1 text-ods-text-secondary text-h6">{helperText}</p>
      </div>
      <div
        className="overflow-hidden rounded-lg border border-ods-border bg-ods-card"
        style={{ minHeight: `${minHeight}px` }}
      >
        <Textarea
          id={id}
          value={subtitles || ''}
          onChange={e => onSubtitlesChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || !onSubtitlesChange}
          className="h-full w-full resize-none border-0 bg-transparent p-4 text-ods-text-primary text-code placeholder:text-ods-text-secondary/50 focus:outline-none focus:ring-0"
          style={{ minHeight: `${minHeight}px`, lineHeight: '1.6' }}
        />
      </div>
    </div>
  );
}

export default SubtitlesEditor;
