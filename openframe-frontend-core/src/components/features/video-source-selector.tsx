"use client";

import React, { useState, useCallback } from 'react';
import { Upload, Sparkles, X, Video } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { YouTubeIcon } from '../icons/youtube-icon';

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
  uploadedVideoUrl: string;
  /** Callback when uploaded video URL changes */
  onUploadedVideoUrlChange: (url: string) => void;
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
  uploadedVideoUrl,
  onUploadedVideoUrlChange,
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
        onUploadedVideoUrlChange(url);
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
  }, [onUploadVideo, onUploadedVideoUrlChange]);

  const handleDeleteVideo = useCallback(() => {
    onUploadedVideoUrlChange('');
  }, [onUploadedVideoUrlChange]);

  return (
    <div className={`space-y-4 p-6 bg-ods-card border border-ods-border rounded-lg ${className}`}>
      {/* Section Title */}
      {showTitle && (
        <h3 className="font-['Azeret_Mono'] text-[18px] font-semibold uppercase text-ods-text-primary flex items-center gap-2">
          <Video className="h-5 w-5" />
          {title}
        </h3>
      )}

      {/* Video Source Type Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={videoSourceType === 'youtube' ? 'primary' : 'outline'}
          onClick={() => onVideoSourceTypeChange('youtube')}
          leftIcon={<YouTubeIcon className="h-4 w-4" color="currentColor" />}
          disabled={disabled}
        >
          YouTube URL
        </Button>
        <Button
          type="button"
          variant={videoSourceType === 'uploaded' ? 'primary' : 'outline'}
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
            <p className="text-xs text-ods-text-secondary">
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
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Generated
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
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
                <span className="text-xs text-ods-text-secondary">{uploadProgress}%</span>
              </div>
              <p className="text-xs text-ods-text-secondary">{uploadMessage}</p>
            </div>
          )}

          {/* Upload Error */}
          {uploadError && (
            <p className="text-sm text-ods-attention-red-error mb-3">{uploadError}</p>
          )}

          {/* Video Preview */}
          {uploadedVideoUrl ? (
            VideoPreviewComponent ? (
              <VideoPreviewComponent
                videoUrl={uploadedVideoUrl}
                onDelete={handleDeleteVideo}
                isAIGenerated={isAIGenerated}
              />
            ) : (
              // Default simple preview
              <div className="relative rounded-lg border border-ods-border overflow-hidden">
                <video
                  src={uploadedVideoUrl}
                  className="w-full h-auto max-h-[300px] object-contain bg-black"
                  controls
                />
                <button
                  type="button"
                  onClick={handleDeleteVideo}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
                  disabled={disabled}
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            )
          ) : (
            <p className="text-sm text-ods-text-secondary italic">
              {uploadEmptyText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default VideoSourceSelector;
