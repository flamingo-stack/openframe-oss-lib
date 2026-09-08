'use client';

import { Loader2, Image as ImageIcon, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import Image from '../embed-shims/next-image';
import { useToast } from '../hooks/use-toast';
import { errorMessage } from '../utils/common';
import { Button } from './ui/button';

interface HeroImageUploaderProps {
  /** Current image URL if one already exists */
  imageUrl?: string;
  /** Callback fired with new image URL (or undefined if removed) */
  onChange: (url: string | undefined) => void;
  /** Upload endpoint (required) */
  uploadEndpoint: string;
  /** Height of drop-zone. Number treated as pixels, string passed directly (e.g. '100%') */
  height?: number | string;
  /** Image object-fit, defaults to cover */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  /** Show a replace/upload button overlay in addition to remove (default true for parity with blog editor) */
  showReplaceButton?: boolean;
  /** If true, skip the actual upload and just return a base64 data URL preview. Useful for unauthenticated flows – the caller can upload later. */
  deferUpload?: boolean;
  /** Optional custom upload handler for authenticated uploads. If provided, this will be used instead of the default fetch */
  onUpload?: (file: File) => Promise<string>;
  /** Optional custom delete handler for authenticated deletion. If provided, this will be used instead of just clearing the image */
  onDelete?: () => Promise<void>;
}

/**
 * Pull the stored URL out of an upload response.
 *
 * `uploadEndpoint` is caller-supplied, and the three endpoints in the fleet
 * answer with three different envelopes — `{ data: { url } }` (the hub's
 * media routes), `{ url }` (the blob upload proxy) and `{ file_url }` (the
 * legacy supabase route). Returns null when none of them is a usable string,
 * which the caller reports as "Invalid upload response".
 */
function readUploadedUrl(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;

  if ('data' in payload) {
    const nested = payload.data;
    if (typeof nested === 'object' && nested !== null && 'url' in nested) {
      if (typeof nested.url === 'string' && nested.url) return nested.url;
    }
  }
  if ('url' in payload && typeof payload.url === 'string' && payload.url) return payload.url;
  if ('file_url' in payload && typeof payload.file_url === 'string' && payload.file_url) return payload.file_url;

  return null;
}

/**
 * Reusable dashed hero-style image uploader identical to Blog Editor's hero picker.
 * Handles client-side validation (JPEG/PNG/WebP/GIF up to 5 MB), upload, preview & removal.
 */
export function HeroImageUploader({
  imageUrl,
  onChange,
  uploadEndpoint,
  height = 300,
  objectFit = 'cover',
  showReplaceButton = true,
  deferUpload = false,
  onUpload,
  onDelete,
}: HeroImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  const openDialog = () => inputRef.current?.click();

  async function handleFile(file?: File) {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: 'Invalid file', description: 'Upload JPEG, PNG, WebP, or GIF', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: 'File too large', description: 'Max 5MB', variant: 'destructive' });
      return;
    }

    if (deferUpload) {
      // Immediately convert to data URL for preview and postpone real upload
      try {
        setUploading(true);
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          onChange(dataUrl); // Return data URL so parent can preview & store locally
          setUploading(false);
        };
        reader.onerror = () => {
          toast({ title: 'File error', description: 'Failed to read image file', variant: 'destructive' });
          setUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        toast({
          title: 'File error',
          description: errorMessage(err, 'Failed to process image'),
          variant: 'destructive',
        });
        setUploading(false);
      } finally {
        if (inputRef.current) inputRef.current.value = '';
      }
      return;
    }

    // Upload flow - use custom handler if provided, otherwise use default fetch
    setUploading(true);
    try {
      let uploadedUrl: string;

      if (onUpload) {
        // Use custom upload handler (e.g., for authenticated uploads)
        uploadedUrl = await onUpload(file);
      } else {
        // Default upload flow
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(uploadEndpoint, { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Upload failed');
        const json: unknown = await res.json();
        const url = readUploadedUrl(json);
        if (!url) throw new Error('Invalid upload response');
        uploadedUrl = url;
      }

      onChange(uploadedUrl);
    } catch (err) {
      toast({ title: 'Upload error', description: errorMessage(err, 'Failed to upload'), variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const handleSelect = (e: ChangeEvent<HTMLInputElement>) => {
    // `handleFile` never rejects — it toasts failures and resets in `finally`.
    void handleFile(e.target.files?.[0]);
  };

  const handleRemove = async () => {
    if (onDelete) {
      try {
        await onDelete();
      } catch {
        // onDelete handler should handle its own error reporting
        return;
      }
    }
    onChange(undefined);
  };

  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className="h-full max-h-full min-h-[300px] w-full space-y-2">
      {imageUrl ? (
        <div
          className="group relative flex aspect-square h-auto w-full items-center justify-center overflow-hidden md:aspect-auto md:h-full"
          style={{ height: heightStyle }}
        >
          <Image src={imageUrl} className={`object-${objectFit}`} alt="Cover" fill sizes="100vw" unoptimized />
          <div className="absolute inset-0 flex items-center justify-center gap-4 rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            {showReplaceButton && (
              <Button
                variant="outline"
                size="icon"
                onClick={openDialog}
                className="h-12 w-12 rounded-full bg-white text-black hover:bg-gray-100"
              >
                <Upload className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleRemove()}
              className="h-12 w-12 rounded-full bg-white text-black hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={`h-full w-full border-2 border-dashed ${uploading ? 'border-ods-accent' : 'border-ods-border hover:border-ods-accent'} flex cursor-pointer flex-col items-center justify-center rounded-lg bg-ods-bg`}
          style={{ height: heightStyle }}
          onClick={openDialog}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-ods-accent" />
          ) : (
            <>
              <ImageIcon className="h-12 w-12 text-ods-text-secondary" />
              <span className="mt-2 text-ods-text-primary text-h6">Upload cover image</span>
              <span className="mt-1 text-ods-text-secondary text-h6">Click to upload or drag and drop</span>
              <span className="text-ods-text-secondary text-h6">PNG, JPEG, WebP, GIF up to 5MB</span>
            </>
          )}
        </div>
      )}

      {/* hidden input */}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleSelect} className="hidden" />
    </div>
  );
}
