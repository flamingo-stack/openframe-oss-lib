"use client";

import { useState, useRef } from 'react';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '../ui';
import { Trash2, Plus, Image as ImageIcon, Video, Upload, Loader2, GripVertical } from 'lucide-react';
import Image from 'next/image';

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

export function ReleaseMediaManager({
  media,
  onChange,
  onUpload,
  className = ''
}: ReleaseMediaManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      _uploading: true
    };

    onChange([...media, newMedia]);
    setUploadingIndex(newIndex);

    try {
      // Upload file
      const url = await onUpload(file, mediaType);

      // Update with uploaded URL
      const updated = [...media, { ...newMedia, media_url: url, _file: undefined, _uploading: false }];
      onChange(updated);
    } catch (error) {
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

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetIndex: number) => (e: React.DragEvent) => {
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
        return <Video className="w-5 h-5 text-ods-text-secondary" />;
      default:
        return <ImageIcon className="w-5 h-5 text-ods-text-secondary" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Section */}
      <div className="border-2 border-dashed border-ods-border rounded-lg p-6 text-center hover:border-[#FFC008]/50 transition-colors">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-ods-card flex items-center justify-center">
            {uploadingIndex !== null ? (
              <Loader2 className="h-6 w-6 animate-spin text-ods-accent" />
            ) : (
              <Upload className="h-6 w-6 text-ods-accent" />
            )}
          </div>
          <div>
            <h3 className="font-['DM_Sans'] font-semibold text-ods-text-primary mb-1">
              {uploadingIndex !== null ? 'Uploading...' : 'Upload Media'}
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
            disabled={uploadingIndex !== null}
            leftIcon={<Plus className="h-4 w-4" />}
            className="font-['DM_Sans'] text-[16px] font-bold"
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
          <div className="flex items-center justify-between mb-4">
            <Label className="text-[14px] text-ods-text-primary">Media Gallery ({media.length})</Label>
            <p className="text-xs text-ods-text-secondary">Drag to reorder</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {media.map((item, index) => (
              <div
                key={index}
                draggable={!item._uploading}
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={handleDrop(index)}
                className="relative group border border-ods-border rounded-lg overflow-hidden hover:border-[#FFC008]/30 transition-colors bg-ods-bg-secondary"
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
                    onClick={() => removeMedia(index)}
                    disabled={item._uploading}
                    className="h-8 w-8 p-0 bg-red-500 hover:bg-red-600 border-red-500"
                  >
                    <Trash2 className="h-4 w-4 text-white" />
                  </Button>
                </div>

                {/* Media Preview */}
                {item.media_url && (
                  <div className="aspect-video relative bg-[#1A1A1A]">
                    {item.media_type === 'video' || item.media_type === 'demo' ? (
                      <video
                        src={item.media_url}
                        className="w-full h-full object-cover"
                        controls
                        preload="metadata"
                      />
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
                  <div className="aspect-video bg-[#1A1A1A] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-ods-accent" />
                      <span className="text-sm text-ods-text-secondary">Uploading...</span>
                    </div>
                  </div>
                )}

                {/* Media Info */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {getIcon(item.media_type)}
                    <Select
                      value={item.media_type}
                      onValueChange={(value: any) => updateMedia(index, 'media_type', value)}
                      disabled={item._uploading}
                    >
                      <SelectTrigger className="bg-[#161616] h-8 text-xs">
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
                    onChange={(e) => updateMedia(index, 'title', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    className="bg-[#161616] h-8 text-xs"
                    disabled={item._uploading}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {media.length === 0 && (
        <div className="text-center py-8 px-4 bg-ods-bg-secondary border border-ods-border rounded-lg">
          <ImageIcon className="h-12 w-12 text-ods-text-secondary mx-auto mb-4" />
          <h3 className="font-['DM_Sans'] font-semibold text-ods-text-primary mb-2">
            No media uploaded yet
          </h3>
          <p className="text-sm text-ods-text-secondary">
            Upload your first image or video to get started
          </p>
        </div>
      )}
    </div>
  );
}
