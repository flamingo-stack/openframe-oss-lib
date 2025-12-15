"use client";

import React, { useState, useRef, useCallback } from 'react';
import { Modal, ModalHeader, ModalTitle, Button, Card } from '../ui';
import {
  Upload,
  Image as ImageIcon,
  Video,
  Trash2,
  Loader2,
  GripVertical,
  Plus
} from 'lucide-react';
import Image from 'next/image';

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
  showInModal = false,
  modalTitle = 'Media Gallery',
  className = ''
}: MediaGalleryManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      onChange([...media, {
        media_type: mediaType === 'image' ? 'screenshot' : 'demo',
        media_url: url,
        title: file.name,
        display_order: media.length
      }]);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }, [media, onChange, onUpload]);

  const handleDeleteMedia = useCallback((index: number) => {
    setDeletingIndex(index);
    onChange(media.filter((_, i) => i !== index));
    setDeletingIndex(null);
  }, [media, onChange]);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
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
  }, [media, draggedIndex, onChange]);

  const renderMediaItem = useCallback((mediaItem: MediaItem, index: number) => {
    const isDeleting = deletingIndex === index;

    return (
      <Card
        key={index}
        className="relative group border-ods-border hover:border-[#FFC008]/30 transition-colors"
        draggable
        onDragStart={() => handleDragStart(index)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, index)}
      >
        {/* Drag Handle */}
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move z-10">
          <GripVertical className="h-4 w-4 text-white drop-shadow" />
        </div>

        {/* Delete Button */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDeleteMedia(index)}
            disabled={isDeleting}
            className="h-8 w-8 p-0 bg-red-500 hover:bg-red-600 border-red-500"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Trash2 className="h-4 w-4 text-white" />
            )}
          </Button>
        </div>

        {/* Media Content */}
        <div className="aspect-video relative bg-[#1A1A1A] rounded-lg overflow-hidden">
          {mediaItem.media_type === 'video' || mediaItem.media_type === 'demo' ? (
            <video
              src={mediaItem.media_url}
              className="w-full h-full object-cover"
              controls
              preload="metadata"
            />
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
          <div className="flex items-center gap-2 mb-1">
            {mediaItem.media_type === 'video' || mediaItem.media_type === 'demo' ? (
              <Video className="h-4 w-4 text-ods-text-secondary" />
            ) : (
              <ImageIcon className="h-4 w-4 text-ods-text-secondary" />
            )}
            <span className="text-sm font-medium text-ods-text-primary capitalize">
              {mediaItem.media_type}
            </span>
          </div>
          {mediaItem.title && (
            <p className="text-sm text-ods-text-secondary truncate">
              {mediaItem.title}
            </p>
          )}
        </div>
      </Card>
    );
  }, [deletingIndex, handleDragStart, handleDragOver, handleDrop, handleDeleteMedia]);

  const content = (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Section */}
      <div className="border-2 border-dashed border-ods-border rounded-lg p-6 text-center hover:border-[#FFC008]/50 transition-colors">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-ods-card flex items-center justify-center">
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-ods-accent" />
            ) : (
              <Upload className="h-6 w-6 text-ods-accent" />
            )}
          </div>
          <div>
            <h3 className="font-['DM_Sans'] font-semibold text-ods-text-primary mb-1">
              {isUploading ? 'Uploading...' : 'Upload Media'}
            </h3>
            <p className="text-sm text-ods-text-secondary">
              Drag and drop or click to select images and videos
            </p>
            <p className="text-xs text-ods-text-secondary mt-1">
              Maximum file size: 50MB
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            leftIcon={<Plus className="h-4 w-4" />}
            className="font-['DM_Sans'] text-[16px] font-bold"
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
        <div className="text-center py-8">
          <ImageIcon className="h-12 w-12 text-ods-text-secondary mx-auto mb-4" />
          <h3 className="font-['DM_Sans'] font-semibold text-ods-text-primary mb-2">
            No media uploaded yet
          </h3>
          <p className="text-sm text-ods-text-secondary">
            Upload your first image or video to get started
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-['DM_Sans'] font-semibold text-ods-text-primary">
              Media Gallery ({media.length})
            </h3>
            <p className="text-xs text-ods-text-secondary">
              Drag to reorder
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {media.map((item, index) => renderMediaItem(item, index))}
          </div>
        </div>
      )}
    </div>
  );

  return content;
}
