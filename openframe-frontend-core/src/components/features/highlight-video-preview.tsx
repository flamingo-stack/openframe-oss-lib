"use client";

import React, { ReactNode } from 'react';
import { Upload, Sparkles } from 'lucide-react';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

export interface HighlightVideoPreviewProps {
  /** Highlight video URL */
  highlightVideoUrl?: string | null;
  /** Video thumbnail URL */
  highlightVideoThumbnail?: string | null;
  /** Video duration in milliseconds */
  highlightVideoDurationMs?: number | null;
  /** Whether video was AI generated */
  highlightVideoSource?: 'manual' | 'ai_generated' | null;
  /** Handler to upload a new highlight video - receives File, should return uploaded URL */
  onUpload: (file: File) => Promise<string>;
  /** Handler to delete the highlight video */
  onDelete: () => Promise<void>;
  /** Whether upload is in progress */
  isUploading?: boolean;
  /** Custom label */
  label?: string;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Upload progress component (optional) */
  uploadProgressComponent?: ReactNode;
  /** Video preview component - receives video data, should render the preview */
  renderVideoPreview: (props: {
    videoUrl: string;
    title: string;
    thumbnailUrl?: string;
    onDelete: () => Promise<void>;
  }) => ReactNode;
}

/**
 * HighlightVideoPreview - Unified component for highlight video preview and manual upload
 *
 * This component provides a consistent UI for both CustomerInterview and ProductRelease entities
 * for displaying and manually uploading highlight videos.
 */
export function HighlightVideoPreview({
  highlightVideoUrl,
  highlightVideoThumbnail,
  highlightVideoDurationMs,
  highlightVideoSource,
  onUpload,
  onDelete,
  isUploading = false,
  label = "Highlight Video",
  emptyMessage = "No highlight video yet. Use AI generation above or upload manually.",
  uploadProgressComponent,
  renderVideoPreview,
}: HighlightVideoPreviewProps) {
  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      await onUpload(file);
    };
    input.click();
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Label>{label}</Label>
          {highlightVideoSource === 'ai_generated' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI Generated
            </Badge>
          )}
          {highlightVideoDurationMs && (
            <Badge variant="outline" className="text-xs">
              {formatDuration(highlightVideoDurationMs)}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<Upload className="h-4 w-4" />}
          onClick={handleUploadClick}
          disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload Highlight'}
        </Button>
      </div>

      {uploadProgressComponent}

      {highlightVideoUrl ? (
        renderVideoPreview({
          videoUrl: highlightVideoUrl,
          title: 'Highlight Video',
          thumbnailUrl: highlightVideoThumbnail || undefined,
          onDelete,
        })
      ) : (
        <p className="text-sm text-ods-text-secondary italic">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}

export default HighlightVideoPreview;
