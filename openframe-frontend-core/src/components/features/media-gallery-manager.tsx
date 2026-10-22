'use client';

import { Upload, Image as ImageIcon, Video as VideoIcon, Trash2, Loader2, GripVertical, Plus } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from '../../embed-shims/next-image';
import { cn } from '../../utils/cn';
import {
  fileContentKey,
  fileMediaType,
  IMAGE_FILE_ACCEPT,
  isVideoMedia,
  MEDIA_FILE_ACCEPT,
  mediaNameKey,
  type PublishableMediaType,
} from '../../utils/media-type';
import { Button, Card, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui';

import { Video } from './video';

export interface MediaItem {
  id?: string | number; // Optional for new items
  media_type: 'image' | 'video' | 'screenshot' | 'demo';
  media_url: string;
  title?: string;
  description?: string;
  display_order?: number;
}

export interface MediaGalleryManagerProps {
  media: MediaItem[];
  /** The gallery after an add, a removal, a reorder or an edit. */
  onChange: (media: MediaItem[]) => void;
  /** Stores one file and answers its URL. An empty answer or a throw means it was not stored. */
  onUpload: (file: File, mediaType: PublishableMediaType) => Promise<string>;
  /** Each tile carries a type select and a title field (a gallery whose items are captioned). */
  editableDetails?: boolean;
  /** Tiles per row on a wide screen. Default 3. */
  columns?: 2 | 3;
  className?: string;
}

/** What the intake compares a picked file with: an item's stored URL and the name it was uploaded under. */
export interface MediaIntakeExisting {
  media_url?: string | null;
  title?: string | null;
}

/** Whether a picked file is already there: the name it was uploaded under, or its stored file name. */
function isAlreadyThere(file: File, existing: ReadonlyArray<MediaIntakeExisting>): boolean {
  const key = mediaNameKey(file.name);
  if (!key) return false;
  return existing.some(
    item =>
      (item.title ? mediaNameKey(item.title) === key : false) ||
      (item.media_url ? mediaNameKey(item.media_url) === key : false),
  );
}

const isFileDrag = (event: React.DragEvent) => Array.from(event.dataTransfer.types).includes('Files');
const isVideoItem = (item: MediaItem) => isVideoMedia(item) || item.media_type === 'demo';

const MEDIA_KIND_ACCEPT = { image: IMAGE_FILE_ACCEPT, video: 'video/*', both: MEDIA_FILE_ACCEPT } as const;
const MEDIA_KIND_COPY = {
  image: { noun: 'pictures', refusal: 'Not a picture' },
  video: { noun: 'videos', refusal: 'Not a video' },
  both: { noun: 'pictures and videos', refusal: 'Not a picture or a video' },
} as const;

export interface MediaIntakeOptions {
  /** What is already there (a gallery, a library): a file whose name matches one of these is skipped. */
  existing: ReadonlyArray<MediaIntakeExisting>;
  /**
   * Stores one file and answers its URL (or any non-empty reference when the
   * caller keeps the record itself). An empty answer or a throw means it was not stored.
   */
  onUpload: (file: File, mediaType: PublishableMediaType) => Promise<string>;
  /** Called after each file is stored. */
  onUploaded?: (stored: { file: File; mediaType: PublishableMediaType; url: string }) => void;
  /** Which files are taken. Default both. */
  kinds?: 'image' | 'video' | 'both';
}

/**
 * THE media intake: any number of files from a picker or a drop, uploaded one
 * after another, never the same file twice. The same bytes picked twice in one
 * batch (SHA-256) and a file whose name is already in `existing` are skipped,
 * and `notice` says which. `MediaGalleryManager` and every other screen that
 * takes media (`MediaUploadArea`) run on it.
 */
export function useMediaIntake({ existing, onUpload, onUploaded, kinds = 'both' }: MediaIntakeOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  // What is there NOW, for an upload batch that outlives the render that started it.
  const existingRef = useRef(existing);
  useEffect(() => {
    existingRef.current = existing;
  }, [existing]);
  const [dropActive, setDropActive] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const duplicates: string[] = [];
      const unsupported: string[] = [];
      const failed: string[] = [];
      const seen = new Set<string>();
      const accepted: Array<{ file: File; mediaType: PublishableMediaType }> = [];
      for (const file of files) {
        const mediaType = fileMediaType(file);
        if (!mediaType || (kinds !== 'both' && mediaType !== kinds)) {
          unsupported.push(file.name);
          continue;
        }
        const contentKey = await fileContentKey(file).catch(() => `${file.name}:${file.size}`);
        if (seen.has(contentKey) || isAlreadyThere(file, existingRef.current)) {
          duplicates.push(file.name);
          continue;
        }
        seen.add(contentKey);
        accepted.push({ file, mediaType });
      }

      setPending(accepted.map(entry => entry.file.name));
      for (const { file, mediaType } of accepted) {
        try {
          const url = await onUpload(file, mediaType);
          if (!url) throw new Error('no URL');
          onUploaded?.({ file, mediaType, url });
        } catch (error) {
          console.error('Upload failed:', error);
          failed.push(file.name);
        }
        setPending(names => names.slice(1));
      }

      const parts = [
        duplicates.length > 0 ? `Already there, skipped: ${duplicates.join(', ')}` : null,
        unsupported.length > 0 ? `${MEDIA_KIND_COPY[kinds].refusal}, skipped: ${unsupported.join(', ')}` : null,
        failed.length > 0 ? `Could not upload: ${failed.join(', ')}` : null,
      ].filter(Boolean);
      setNotice(parts.length > 0 ? parts.join('. ') : null);
      if (inputRef.current) inputRef.current.value = '';
    },
    [kinds, onUpload, onUploaded],
  );

  return {
    kinds,
    pending,
    notice,
    busy: pending.length > 0,
    dropActive,
    open: () => inputRef.current?.click(),
    /** Spread on the element files may be dropped on (the area itself, or a whole gallery). */
    dropHandlers: {
      onDragOver: (event: React.DragEvent) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        setDropActive(true);
      },
      onDragLeave: () => setDropActive(false),
      onDrop: (event: React.DragEvent) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        setDropActive(false);
        void addFiles(Array.from(event.dataTransfer.files));
      },
    },
    /** Spread on the hidden `<input type="file">`. */
    inputProps: {
      ref: inputRef,
      type: 'file' as const,
      multiple: true,
      'aria-label': 'Select media files',
      accept: MEDIA_KIND_ACCEPT[kinds],
      className: 'hidden',
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => void addFiles(Array.from(event.target.files ?? [])),
    },
  };
}

export type MediaIntake = ReturnType<typeof useMediaIntake>;

/**
 * The drop area of a media intake: drop files on it or pick any number of them.
 * `ownDrop` makes the area the drop target (a screen with no gallery around it);
 * a gallery spreads the intake's `dropHandlers` on itself instead.
 */
export function MediaUploadArea({
  intake,
  title = 'Upload Media',
  ownDrop = false,
  disabled = false,
  className,
}: {
  intake: MediaIntake;
  title?: string;
  ownDrop?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const { busy, pending } = intake;
  return (
    <div
      {...(ownDrop ? intake.dropHandlers : {})}
      className={cn(
        'rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-ods-accent/50',
        intake.dropActive ? 'border-ods-accent bg-ods-accent/5' : 'border-ods-border',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ods-card">
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-ods-accent" />
          ) : (
            <Upload className="h-6 w-6 text-ods-accent" />
          )}
        </div>
        <div>
          <h3 className="mb-1 text-ods-text-primary text-h3">
            {busy ? `Uploading ${pending.length} ${pending.length === 1 ? 'file' : 'files'}...` : title}
          </h3>
          <p className="text-ods-text-secondary text-h6">
            Drop {MEDIA_KIND_COPY[intake.kinds].noun} here, or select any number of them
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={intake.open}
          disabled={busy || disabled}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          {busy ? 'Uploading...' : 'Select Files'}
        </Button>
        {intake.notice && (
          <p role="status" className="text-ods-warning text-h6">
            {intake.notice}
          </p>
        )}
      </div>
      <input {...intake.inputProps} disabled={busy || disabled} />
    </div>
  );
}

/**
 * THE media gallery editor: pick or drop any number of pictures and videos,
 * reorder them by dragging, remove them. Every gallery (events, releases,
 * People Hub entries, design docs, categories) is this component, on the one
 * intake (`useMediaIntake`), so a file is never added twice.
 */
export function MediaGalleryManager({
  media,
  onChange,
  onUpload,
  editableDetails = false,
  columns = 3,
  className = '',
}: MediaGalleryManagerProps) {
  // The gallery as it is NOW, for an upload batch that outlives the render that started it.
  const mediaRef = useRef(media);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const batchRef = useRef<MediaItem[] | null>(null);
  const intake = useMediaIntake({
    existing: media,
    onUpload,
    onUploaded: ({ file, mediaType, url }) => {
      // Files of one batch land one after another: each is appended to the list the
      // previous one produced, which the parent may not have rendered back yet.
      const base = batchRef.current ?? mediaRef.current;
      const next: MediaItem[] = [
        ...base,
        {
          media_type: mediaType === 'image' ? 'screenshot' : 'demo',
          media_url: url,
          title: file.name,
          display_order: base.length,
        },
      ];
      batchRef.current = next;
      onChange(next);
    },
  });
  const { pending, busy } = intake;
  useEffect(() => {
    if (!busy) batchRef.current = null;
  }, [busy]);

  const update = (index: number, patch: Partial<MediaItem>) =>
    onChange(media.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const handleTileDrop = (event: React.DragEvent, targetIndex: number) => {
    // A file dragged from the desktop onto a tile is an upload, not a reorder.
    if (isFileDrag(event)) return;
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }
    const next = [...media];
    const [moved] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next.map((item, i) => ({ ...item, display_order: i })));
    setDraggedIndex(null);
  };

  return (
    <div className={`space-y-6 ${className}`} {...intake.dropHandlers}>
      {/* Drop files anywhere on the gallery, or pick any number of them. */}
      <MediaUploadArea intake={intake} />

      {media.length === 0 && !busy ? (
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
          <div
            className={cn('grid grid-cols-1 gap-4 content-md:grid-cols-2', columns === 3 && 'content-lg:grid-cols-3')}
          >
            {media.map((item, index) => (
              <Card
                key={item.id ?? `${item.media_url}-${index}`}
                className="group relative border-ods-border transition-colors hover:border-ods-accent/30"
                draggable
                onDragStart={() => setDraggedIndex(index)}
                onDragOver={event => {
                  if (!isFileDrag(event)) event.preventDefault();
                }}
                onDrop={event => handleTileDrop(event, index)}
              >
                <div className="absolute left-2 top-2 z-10 cursor-move opacity-0 transition-opacity group-hover:opacity-100">
                  <GripVertical className="h-4 w-4 text-ods-text-on-dark drop-shadow" />
                </div>
                <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="small-legacy"
                    aria-label={`Remove ${item.title || 'media'}`}
                    onClick={() => onChange(media.filter((_, i) => i !== index))}
                    className="h-8 w-8 border-ods-error bg-ods-error p-0 hover:bg-ods-error-hover"
                  >
                    <Trash2 className="h-4 w-4 text-ods-text-on-dark" />
                  </Button>
                </div>

                <div className="relative aspect-video overflow-hidden rounded-lg bg-ods-bg">
                  {isVideoItem(item) ? (
                    // <Video> SSOT (MuxPlayer): plays Mux HLS and MP4 alike; fit="cover" crops to the cell.
                    <Video kind="file" url={item.media_url} fit="cover" className="h-full w-full" />
                  ) : (
                    <Image
                      src={item.media_url}
                      alt={item.title || 'Media'}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  )}
                </div>

                {editableDetails ? (
                  <div className="space-y-2 p-3">
                    <div className="flex items-center gap-2">
                      {isVideoItem(item) ? (
                        <VideoIcon className="h-5 w-5 text-ods-text-secondary" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-ods-text-secondary" />
                      )}
                      <Select
                        value={item.media_type}
                        onValueChange={(value: string) =>
                          update(index, { media_type: value as MediaItem['media_type'] })
                        }
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
                      value={item.title ?? ''}
                      onChange={event => update(index, { title: event.target.value })}
                      onKeyDown={event => event.key === 'Enter' && event.preventDefault()}
                      className="h-8 bg-ods-bg text-h6"
                    />
                  </div>
                ) : (
                  <div className="p-3">
                    <div className="mb-1 flex items-center gap-2">
                      {isVideoItem(item) ? (
                        <VideoIcon className="h-4 w-4 text-ods-text-secondary" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-ods-text-secondary" />
                      )}
                      <span className="capitalize text-ods-text-primary text-h6">{item.media_type}</span>
                    </div>
                    {item.title && <p className="truncate text-ods-text-secondary text-h6">{item.title}</p>}
                  </div>
                )}
              </Card>
            ))}
            {pending.map((name, index) => (
              <Card key={`pending-${name}-${index}`} className="border-ods-border" aria-busy="true">
                <div className="flex aspect-video items-center justify-center rounded-lg bg-ods-bg">
                  <Loader2 className="h-8 w-8 animate-spin text-ods-accent" />
                </div>
                <p className="truncate p-3 text-ods-text-secondary text-h6">{name}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
