"use client";

import { useRef, useState } from 'react';
import { Loader2, Image as ImageIcon, Upload, X } from 'lucide-react';
import { Button } from "./ui/button";
import { useToast } from "../hooks/use-toast";

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
 * Reusable dashed hero-style image uploader identical to Blog Editor's hero picker.
 * Handles client-side validation (JPEG/PNG/WebP/GIF up to 5 MB), upload, preview & removal.
 */
export function HeroImageUploader({ imageUrl, onChange, uploadEndpoint, height = 300, objectFit = 'cover', showReplaceButton = true, deferUpload = false, onUpload, onDelete }: HeroImageUploaderProps) {
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
      } catch (err: any) {
        toast({ title: 'File error', description: err.message || 'Failed to process image', variant: 'destructive' });
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
        const json = await res.json();
        uploadedUrl = (json.data && json.data.url) || json.url || json.file_url;
        if (!uploadedUrl) throw new Error('Invalid upload response');
      }
      
      onChange(uploadedUrl);
    } catch (err: any) {
      toast({ title: 'Upload error', description: err.message || 'Failed to upload', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
  };

  const handleRemove = async () => {
    if (onDelete) {
      try {
        await onDelete();
      } catch (error) {
        // onDelete handler should handle its own error reporting
        return;
      }
    }
    onChange(undefined);
  };

  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className="w-full h-full max-h-full space-y-2 min-h-[300px]">
      {imageUrl ? (
        <div className="relative group w-full aspect-square md:aspect-auto h-auto md:h-full flex items-center justify-center overflow-hidden" style={{ height: heightStyle }}>
          <img src={imageUrl} className={`absolute inset-0 w-full h-full object-${objectFit}`} alt="Cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 transition-opacity rounded-lg">
            {showReplaceButton && (
              <Button
                variant="outline"
                size="icon"
                onClick={openDialog}
                className="bg-white text-black hover:bg-gray-100 rounded-full w-12 h-12"
              >
                <Upload className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleRemove()}
              className="bg-white text-black hover:bg-gray-100 rounded-full w-12 h-12"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={`w-full h-full border-2 border-dashed ${uploading ? 'border-[#FFC008]' : 'border-ods-border hover:border-[#FFC008]'} rounded-lg flex flex-col items-center justify-center cursor-pointer bg-[#1A1A1A]`}
          style={{ height: heightStyle }}
          onClick={openDialog}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-ods-accent" />
          ) : (
            <>
              <ImageIcon className="h-12 w-12 text-ods-text-secondary" />
              <span className="text-ods-text-primary font-['DM_Sans'] text-[16px] font-medium mt-2">Upload cover image</span>
              <span className="text-ods-text-secondary font-['DM_Sans'] text-[14px] mt-1">Click to upload or drag and drop</span>
              <span className="text-[#666666] font-['DM_Sans'] text-[12px]">PNG, JPEG, WebP, GIF up to 5MB</span>
            </>
          )}
        </div>
      )}

      {/* hidden input */}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleSelect} className="hidden" />
    </div>
  );
} 