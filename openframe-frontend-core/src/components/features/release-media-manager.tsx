'use client';

import { Trash2, Plus, Image as ImageIcon, Video as VideoIcon, Upload, Loader2, GripVertical } from 'lucide-react';
import { useState, useRef } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import Image from '../../embed-shims/next-image';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui';
import { Video } from './video';

export interface ReleaseMediaItem {
  media_type: 'image' | 'video' | 'screenshot' | 'demo';
  media_url: string;
  title?: string;
  description?: string;
  display_order?: number;
  _file?: File; // Temporary file before upload
  _uploading?: boolean; // Upload in progress
}

interface ReleaseMediaManagerProps {
  media: ReleaseMediaItem[];
  onChange: (media: ReleaseMediaItem[]) => void;
  onUpload: (file: File, mediaType: 'image' | 'video' | 'screenshot' | 'demo') => Promise<string>; // Returns uploaded URL
  className?: string;
}

export function ReleaseMediaManager({ media, onChange, onUpload, className = '' }: ReleaseMediaManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Determine media type
    let mediaType: 'image' | 'video' | 'screenshot' | 'demo';
    if (file.type.startsWith('image/')) {
      mediaType = 'screenshot';
    } else if (file.type.startsWith('video/')) {
      mediaType = 'demo';
    } else {
      return;
    }

    // Add media item with uploading state
    const newIndex = media.length;
    const newMedia: ReleaseMediaItem = {
      media_type: mediaType,
      media_url: '',
      title: file.name,
      _file: file,
      _uploading: true,
    };

    onChange([...media, newMedia]);
    setUploadingIndex(newIndex);

    try {
      // Upload file
      const url = await onUpload(file, mediaType);

      // Update with uploaded URL
      const updated = [...media, { ...newMedia, media_url: url, _file: undefined, _uploading: false }];
      onChange(updated);
    } catch {
      // Remove failed upload
      onChange(media);
    } finally {
      setUploadingIndex(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeMedia = (index: number) => {
    onChange(media.filter((_, i) => i !== index));
  };

  const updateMedia = (index: number, field: keyof ReleaseMediaItem, value: string) => {
    const updated = [...media];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleDragStart = (index: number) => (e: DragEvent) => {
    const transfer = e.dataTransfer;
    transfer.effectAllowed = 'move';
    transfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    const transfer = e.dataTransfer;
    transfer.dropEffect = 'move';
  };

  const handleDrop = (targetIndex: number) => (e: DragEvent) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));

    if (sourceIndex === targetIndex) return;

    const newMedia = [...media];
    const [draggedItem] = newMedia.splice(sourceIndex, 1);
    newMedia.splice(targetIndex, 0, draggedItem);

    onChange(newMedia.map((item, i) => ({ ...item, display_order: i })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'video':
      case 'demo':
        return <VideoIcon className="h-5 w-5 text-ods-text-secondary" />;
      default:
        return <ImageIcon className="h-5 w-5 text-ods-text-secondary" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Section */}
      <div className="rounded-lg border-2 border-dashed border-ods-border p-6 text-center transition-colors hover:border-ods-accent/50">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ods-card">
            {uploadingIndex !== null ? (
              <Loader2 className="h-6 w-6 animate-spin text-ods-accent" />
            ) : (
              <Upload className="h-6 w-6 text-ods-accent" />
            )}
          </div>
          <div>
            <h3 className="mb-1 text-ods-text-primary text-h3">
              {uploadingIndex !== null ? 'Uploading...' : 'Upload Media'}
            </h3>
            <p className="text-ods-text-secondary text-h6">Drag and drop or click to select images and videos</p>
            <p className="mt-1 text-ods-text-secondary text-h6">Maximum file size: 50MB</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingIndex !== null}
            leftIcon={<Plus className="h-4 w-4" />}
            className="font-bold text-h6"
          >
            {uploadingIndex !== null ? 'Uploading...' : 'Select Files'}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploadingIndex !== null}
      />

      {/* Media Grid */}
      {media.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <Label>Media Gallery ({media.length})</Label>
            <p className="text-ods-text-secondary text-h6">Drag to reorder</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {media.map((item, index) => (
              <div
                key={index}
                draggable={!item._uploading}
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={handleDrop(index)}
                className="group relative overflow-hidden rounded-lg border border-ods-border bg-ods-bg-surface transition-colors hover:border-ods-accent/30"
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
                    onClick={() => removeMedia(index)}
                    disabled={item._uploading}
                    className="h-8 w-8 border-ods-error bg-ods-error p-0 hover:bg-ods-error-hover"
                  >
                    <Trash2 className="h-4 w-4 text-ods-text-on-dark" />
                  </Button>
                </div>

                {/* Media Preview */}
                {item.media_url && (
                  <div className="relative aspect-video bg-ods-bg">
                    {item.media_type === 'video' || item.media_type === 'demo' ? (
                      // <Video> SSOT (MuxPlayer) — plays Mux HLS + MP4 alike;
                      // fit="cover" crops to the aspect-video cell.
                      <Video kind="file" url={item.media_url} fit="cover" className="h-full w-full" />
                    ) : (
                      <Image
                        src={item.media_url}
                        alt={item.title || 'Media'}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    )}
                  </div>
                )}

                {item._uploading && (
                  <div className="flex aspect-video items-center justify-center bg-ods-bg">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-ods-accent" />
                      <span className="text-ods-text-secondary text-h6">Uploading...</span>
                    </div>
                  </div>
                )}

                {/* Media Info */}
                <div className="space-y-2 p-3">
                  <div className="flex items-center gap-2">
                    {getIcon(item.media_type)}
                    <Select
                      value={item.media_type}
                      onValueChange={(value: string) => updateMedia(index, 'media_type', value)}
                      disabled={item._uploading}
                    >
                      <SelectTrigger className="h-8 bg-ods-bg text-h6">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-ods-card">
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="screenshot">Screenshot</SelectItem>
                        <SelectItem value="demo">Demo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Input
                    placeholder="Title (optional)"
                    value={item.title}
                    onChange={e => updateMedia(index, 'title', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    className="h-8 bg-ods-bg text-h6"
                    disabled={item._uploading}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {media.length === 0 && (
        <div className="rounded-lg border border-ods-border bg-ods-bg-surface px-4 py-8 text-center">
          <ImageIcon className="mx-auto mb-4 h-12 w-12 text-ods-text-secondary" />
          <h3 className="mb-2 text-ods-text-primary text-h3">No media uploaded yet</h3>
          <p className="text-ods-text-secondary text-h6">Upload your first image or video to get started</p>
        </div>
      )}
    </div>
  );
}
