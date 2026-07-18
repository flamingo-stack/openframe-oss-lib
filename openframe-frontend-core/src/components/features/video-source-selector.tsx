"use client";

import React, { useState, useCallback } from 'react';
import { Upload, X, Video as VideoIcon } from 'lucide-react';
import { AIGeneratedBadge } from '../ui/ai-generated-badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { YouTubeIcon } from '../icons/youtube-icon';
import { Video } from './video';

export type VideoSourceType = 'youtube' | 'uploaded';

export interface VideoSourceSelectorProps {
  /** Current video source type selection */
  videoSourceType: VideoSourceType;
  /** Callback when video source type changes */
  onVideoSourceTypeChange: (type: VideoSourceType) => void;
  /** YouTube URL value */
  youtubeUrl: string;
  /** Callback when YouTube URL changes */
  onYoutubeUrlChange: (url: string) => void;
  /** Uploaded video URL value */
  mainVideoUrl: string;
  /** Callback when uploaded video URL changes */
  onMainVideoUrlChange: (url: string) => void;
  /** Callback to handle video upload - receives file and returns URL or throws error */
  onUploadVideo: (file: File, onProgress?: (progress: number) => void) => Promise<string>;
  /** Optional: Show AI generated badge on uploaded video */
  showAIBadge?: boolean;
  /** Optional: Whether the video was AI generated */
  isAIGenerated?: boolean;
  /** Optional: Custom label for YouTube section */
  youtubeLabel?: string;
  /** Optional: Custom label for upload section */
  uploadLabel?: string;
  /** Optional: Custom placeholder for YouTube URL input */
  youtubePlaceholder?: string;
  /** Optional: Custom helper text for YouTube section */
  youtubeHelperText?: string;
  /** Optional: Custom empty state text for upload section */
  uploadEmptyText?: string;
  /** Optional: Disable the component */
  disabled?: boolean;
  /** Optional: Custom video preview component */
  VideoPreviewComponent?: React.ComponentType<{
    videoUrl: string;
    onDelete: () => void;
    isAIGenerated?: boolean;
  }>;
  /** Optional: Upload progress bar component */
  UploadProgressComponent?: React.ComponentType<{
    progress: number;
    message: string;
    className?: string;
  }>;
  /** Optional: Section title */
  title?: string;
  /** Optional: Show section title */
  showTitle?: boolean;
  /** Optional: Additional class name */
  className?: string;
}

/**
 * VideoSourceSelector - Unified component for selecting between YouTube URL and uploaded video
 *
 * This component provides a toggle between YouTube URL input and video upload,
 * without clearing data when switching between options.
 */
export function VideoSourceSelector({
  videoSourceType,
  onVideoSourceTypeChange,
  youtubeUrl,
  onYoutubeUrlChange,
  mainVideoUrl,
  onMainVideoUrlChange,
  onUploadVideo,
  showAIBadge = true,
  isAIGenerated = false,
  youtubeLabel = 'YouTube Video URL',
  uploadLabel = 'Uploaded Video',
  youtubePlaceholder = 'https://youtube.com/watch?v=...',
  youtubeHelperText = 'YouTube videos will be embedded. AI processing is not available for YouTube links.',
  uploadEmptyText = 'No video uploaded yet. Click "Upload Video" to add one.',
  disabled = false,
  VideoPreviewComponent,
  UploadProgressComponent,
  title = 'Video',
  showTitle = true,
  className = '',
}: VideoSourceSelectorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUploadClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setUploadProgress(0);
      setUploadMessage('Uploading video...');
      setUploadError(null);

      try {
        const url = await onUploadVideo(file, (progress) => {
          setUploadProgress(progress);
        });
        setUploadProgress(100);
        setUploadMessage('Upload complete!');
        onMainVideoUrlChange(url);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Failed to upload video');
      } finally {
        setIsUploading(false);
        setTimeout(() => {
          setUploadProgress(0);
          setUploadMessage('');
        }, 1000);
      }
    };
    input.click();
  }, [onUploadVideo, onMainVideoUrlChange]);

  const handleDeleteVideo = useCallback(() => {
    onMainVideoUrlChange('');
  }, [onMainVideoUrlChange]);

  return (
    <div className={`space-y-4 p-6 bg-ods-card border border-ods-border rounded-lg ${className}`}>
      {/* Section Title */}
      {showTitle && (
        <h3 className="text-h5 text-ods-text-primary flex items-center gap-2">
          <VideoIcon className="h-5 w-5" />
          {title}
        </h3>
      )}

      {/* Video Source Type Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={videoSourceType === 'youtube' ? 'accent' : 'outline'}
          onClick={() => onVideoSourceTypeChange('youtube')}
          leftIcon={<YouTubeIcon className="h-4 w-4" color="currentColor" />}
          disabled={disabled}
        >
          YouTube URL
        </Button>
        <Button
          type="button"
          variant={videoSourceType === 'uploaded' ? 'accent' : 'outline'}
          onClick={() => onVideoSourceTypeChange('uploaded')}
          leftIcon={<Upload className="h-4 w-4" />}
          disabled={disabled}
        >
          Upload Video
        </Button>
      </div>

      {/* YouTube URL Input */}
      {videoSourceType === 'youtube' && (
        <div className="space-y-2">
          <Label>{youtubeLabel}</Label>
          <Input
            value={youtubeUrl}
            onChange={(e) => onYoutubeUrlChange(e.target.value)}
            placeholder={youtubePlaceholder}
            className="bg-ods-bg"
            disabled={disabled}
          />
          {youtubeHelperText && (
            <p className="text-h6 text-ods-text-secondary">
              {youtubeHelperText}
            </p>
          )}
        </div>
      )}

      {/* Uploaded Video Section */}
      {videoSourceType === 'uploaded' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Label>{uploadLabel}</Label>
              {showAIBadge && isAIGenerated && (
                <AIGeneratedBadge />
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="small-legacy"
              leftIcon={<Upload className="h-4 w-4" />}
              onClick={handleUploadClick}
              disabled={disabled || isUploading}
            >
              Upload Video
            </Button>
          </div>

          {/* Upload Progress */}
          {isUploading && UploadProgressComponent && (
            <UploadProgressComponent
              progress={uploadProgress}
              message={uploadMessage}
              className="mb-3"
            />
          )}

          {/* Simple progress bar fallback if no custom component */}
          {isUploading && !UploadProgressComponent && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-2 bg-ods-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ods-accent transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-h6 text-ods-text-secondary">{uploadProgress}%</span>
              </div>
              <p className="text-h6 text-ods-text-secondary">{uploadMessage}</p>
            </div>
          )}

          {/* Upload Error */}
          {uploadError && (
            <p className="text-h6 text-ods-error mb-3">{uploadError}</p>
          )}

          {/* Video Preview */}
          {mainVideoUrl ? (
            VideoPreviewComponent ? (
              <VideoPreviewComponent
                videoUrl={mainVideoUrl}
                onDelete={handleDeleteVideo}
                isAIGenerated={isAIGenerated}
              />
            ) : (
              <DefaultVideoPreview
                videoUrl={mainVideoUrl}
                onDelete={handleDeleteVideo}
                disabled={disabled}
              />
            )
          ) : (
            <p className="text-h6 text-ods-text-secondary italic">
              {uploadEmptyText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface DefaultVideoPreviewProps {
  /** Uploaded video URL — MP4 or Mux HLS manifest, both playable via <Video>. */
  videoUrl: string;
  onDelete: () => void;
  disabled?: boolean;
}

/**
 * Default preview for {@link VideoSourceSelector} when no
 * `VideoPreviewComponent` is supplied. Renders through the `<Video>` SSOT
 * (MuxPlayer), which plays Mux HLS manifests directly on every browser —
 * no HLS→MP4 resolve step needed for playback.
 */
function DefaultVideoPreview({ videoUrl, onDelete, disabled }: DefaultVideoPreviewProps) {
  return (
    <div className="relative rounded-lg border border-ods-border overflow-hidden">
      {/* aspect-video box: MuxPlayer fills its container (width/height 100%),
          so the wrapper must reserve the height the intrinsic-sized native
          <video> used to provide. */}
      <div className="w-full aspect-video max-h-[300px]">
        <Video kind="file" url={videoUrl} />
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete video"
        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
        disabled={disabled}
      >
        <X className="h-4 w-4 text-ods-text-on-dark" />
      </button>
    </div>
  );
}

export default VideoSourceSelector;
