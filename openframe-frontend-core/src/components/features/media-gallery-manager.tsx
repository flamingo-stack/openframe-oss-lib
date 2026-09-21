'use client';

import { Upload, Image as ImageIcon, Video as VideoIcon, Trash2, Loader2, GripVertical, Plus } from 'lucide-react';
import type React from 'react';
import { useState, useRef, useCallback } from 'react';
import Image from '../../embed-shims/next-image';
import { isVideoMedia } from '../../utils/media-type';
import { Button, Card } from '../ui';

import { Video } from './video';
export interface MediaItem {
  id?: string | number; // Optional for new items
  media_type: 'image' | 'video' | 'screenshot' | 'demo';
  media_url: string;
  title?: string;
  description?: string;
  display_order?: number;
  _uploading?: boolean;
}

interface MediaGalleryManagerProps {
  media: MediaItem[];
  onChange: (media: MediaItem[]) => void;
  onUpload: (file: File, mediaType: 'image' | 'video') => Promise<string>;
  isUploading?: boolean;
  showInModal?: boolean;
  modalTitle?: string;
  className?: string;
}

/**
 * Unified Media Gallery Manager
 * Handles upload, display, reordering, and deletion of media items
 * Used across events, product releases, and any content with media galleries
 */
export function MediaGalleryManager({
  media,
  onChange,
  onUpload,
  isUploading = false,
  className = '',
}: MediaGalleryManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Determine media type
      let mediaType: 'image' | 'video';
      if (file.type.startsWith('image/')) {
        mediaType = 'image';
      } else if (file.type.startsWith('video/')) {
        mediaType = 'video';
      } else {
        return;
      }

      try {
        const url = await onUpload(file, mediaType);

        // Add new media item
        onChange([
          ...media,
          {
            media_type: mediaType === 'image' ? 'screenshot' : 'demo',
            media_url: url,
            title: file.name,
            display_order: media.length,
          },
        ]);

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
    },
    [media, onChange, onUpload],
  );

  const handleDeleteMedia = useCallback(
    (index: number) => {
      setDeletingIndex(index);
      onChange(media.filter((_, i) => i !== index));
      setDeletingIndex(null);
    },
    [media, onChange],
  );

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();

      if (draggedIndex === null || draggedIndex === targetIndex) {
        setDraggedIndex(null);
        return;
      }

      const newMedia = [...media];
      const [draggedItem] = newMedia.splice(draggedIndex, 1);
      newMedia.splice(targetIndex, 0, draggedItem);

      onChange(newMedia.map((item, i) => ({ ...item, display_order: i })));
      setDraggedIndex(null);
    },
    [media, draggedIndex, onChange],
  );

  const renderMediaItem = useCallback(
    (mediaItem: MediaItem, index: number) => {
      const isDeleting = deletingIndex === index;

      return (
        <Card
          key={index}
          className="group relative border-ods-border transition-colors hover:border-ods-accent/30"
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={handleDragOver}
          onDrop={e => handleDrop(e, index)}
        >
          {/* Drag Handle */}
          <div className="absolute left-2 top-2 z-10 cursor-move opacity-0 transition-opacity group-hover:opacity-100">
            <GripVertical className="h-4 w-4 text-ods-text-on-dark drop-shadow" />
          </div>

          {/* Delete Button */}
          <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              variant="outline"
              size="small-legacy"
              onClick={() => handleDeleteMedia(index)}
              disabled={isDeleting}
              className="h-8 w-8 border-ods-error bg-ods-error p-0 hover:bg-ods-error-hover"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin text-ods-text-on-dark" />
              ) : (
                <Trash2 className="h-4 w-4 text-ods-text-on-dark" />
              )}
            </Button>
          </div>

          {/* Media Content */}
          <div className="relative aspect-video overflow-hidden rounded-lg bg-ods-bg">
            {isVideoMedia(mediaItem) || mediaItem.media_type === 'demo' ? (
              // <Video> SSOT (MuxPlayer) — plays Mux HLS + MP4 alike;
              // fit="cover" crops to the aspect-video cell.
              <Video kind="file" url={mediaItem.media_url} fit="cover" className="h-full w-full" />
            ) : (
              <Image
                src={mediaItem.media_url}
                alt={mediaItem.title || 'Media'}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            )}
          </div>

          {/* Media Info */}
          <div className="p-3">
            <div className="mb-1 flex items-center gap-2">
              {isVideoMedia(mediaItem) || mediaItem.media_type === 'demo' ? (
                <VideoIcon className="h-4 w-4 text-ods-text-secondary" />
              ) : (
                <ImageIcon className="h-4 w-4 text-ods-text-secondary" />
              )}
              <span className="capitalize text-ods-text-primary text-h6">{mediaItem.media_type}</span>
            </div>
            {mediaItem.title && <p className="truncate text-ods-text-secondary text-h6">{mediaItem.title}</p>}
          </div>
        </Card>
      );
    },
    [deletingIndex, handleDragStart, handleDragOver, handleDrop, handleDeleteMedia],
  );

  const content = (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Section */}
      <div className="rounded-lg border-2 border-dashed border-ods-border p-6 text-center transition-colors hover:border-ods-accent/50">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ods-card">
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-ods-accent" />
            ) : (
              <Upload className="h-6 w-6 text-ods-accent" />
            )}
          </div>
          <div>
            <h3 className="mb-1 text-ods-text-primary text-h3">{isUploading ? 'Uploading...' : 'Upload Media'}</h3>
            <p className="text-ods-text-secondary text-h6">Drag and drop or click to select images and videos</p>
            <p className="mt-1 text-ods-text-secondary text-h6">Maximum file size: 50MB</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            leftIcon={<Plus className="h-4 w-4" />}
            className="font-bold text-h6"
          >
            {isUploading ? 'Uploading...' : 'Select Files'}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {/* Media Grid */}
      {media.length === 0 ? (
        <div className="py-8 text-center">
          <ImageIcon className="mx-auto mb-4 h-12 w-12 text-ods-text-secondary" />
          <h3 className="mb-2 text-ods-text-primary text-h3">No media uploaded yet</h3>
          <p className="text-ods-text-secondary text-h6">Upload your first image or video to get started</p>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-ods-text-primary text-h3">Media Gallery ({media.length})</h3>
            <p className="text-ods-text-secondary text-h6">Drag to reorder</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {media.map((item, index) => renderMediaItem(item, index))}
          </div>
        </div>
      )}
    </div>
  );

  return content;
}
