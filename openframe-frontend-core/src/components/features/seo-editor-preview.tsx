"use client";

import { useState } from 'react';
import { Input, Textarea, Label, Button } from '../ui';
import { Globe, ExternalLink, Upload, X, Loader2 } from 'lucide-react';
import { cn } from '../../utils';
import Image from 'next/image';

export interface SEOEditorPreviewProps {
  // SEO fields - must be strings (not undefined)
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  ogImageUrl: string;

  // Auto-populate sources - must be strings (not undefined)
  title: string;
  summary: string;
  featuredImage: string;

  // Change handlers
  onSeoTitleChange: (value: string) => void;
  onSeoDescriptionChange: (value: string) => void;
  onSeoKeywordsChange: (value: string) => void;
  onOgImageUrlChange: (value: string) => void;

  // Upload handler (provided by parent since it needs API endpoint)
  onOgImageUpload?: (file: File) => Promise<string>;

  // Optional
  domain?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Unified SEO Editor with Live Preview
 * Complete self-contained component for managing SEO meta tags and OG preview
 * Used across blog posts, case studies, and product releases
 */
export function SEOEditorPreview({
  seoTitle,
  seoDescription,
  seoKeywords,
  ogImageUrl,
  title,
  summary,
  featuredImage,
  onSeoTitleChange,
  onSeoDescriptionChange,
  onSeoKeywordsChange,
  onOgImageUrlChange,
  onOgImageUpload,
  domain = 'openmsp.ai',
  disabled = false,
  className = ''
}: SEOEditorPreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);

  // Use fallback values if OG fields are empty
  const displayTitle = seoTitle.trim() || title || 'Untitled';
  const displayDescription = seoDescription.trim() || summary || 'No description';
  const hasOgImage = ogImageUrl.trim();
  const hasFeaturedImage = featuredImage.trim();
  const displayImage = hasOgImage || hasFeaturedImage;

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onOgImageUpload) return;

    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await onOgImageUpload(file);
      onOgImageUrlChange(url);
    } catch (error) {
      console.error('OG image upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn('space-y-6 p-6 bg-ods-card border border-ods-border rounded-lg', className)}>
      <h3 className="font-['Azeret_Mono'] text-[18px] font-semibold uppercase text-ods-text-primary">
        SEO & Open Graph
      </h3>

      {/* SEO Title & Keywords - Same Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="font-['DM_Sans'] text-[14px] font-medium text-ods-text-primary">
            SEO Title
          </Label>
          <Input
            value={seoTitle || ''}
            onChange={(e) => onSeoTitleChange(e.target.value)}
            disabled={disabled}
            placeholder="Enter SEO meta title..."
            className="bg-ods-bg border-ods-border text-ods-text-primary"
          />
          {!seoTitle && title && (
            <p className="text-[11px] text-ods-accent font-['DM_Sans']">
              Auto-populated from title
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="font-['DM_Sans'] text-[14px] font-medium text-ods-text-primary">
            SEO Keywords
          </Label>
          <Input
            value={seoKeywords || ''}
            onChange={(e) => onSeoKeywordsChange(e.target.value)}
            disabled={disabled}
            placeholder="Enter SEO keywords..."
            className="bg-ods-bg border-ods-border text-ods-text-primary"
          />
        </div>
      </div>

      {/* SEO Description & OG Image - Same Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2 flex flex-col h-full">
          <Label className="font-['DM_Sans'] text-[14px] font-medium text-ods-text-primary">
            SEO Description
          </Label>
          <Textarea
            value={seoDescription || ''}
            onChange={(e) => onSeoDescriptionChange(e.target.value)}
            disabled={disabled}
            placeholder="Enter SEO meta description..."
            className="bg-ods-bg border-ods-border text-ods-text-primary flex-1 resize-none"
            rows={6}
          />
          {!seoDescription && summary && (
            <p className="text-[11px] text-ods-accent font-['DM_Sans']">
              Auto-populated from summary
            </p>
          )}
        </div>

        <div className="space-y-2 flex flex-col h-full">
          <Label className="font-['DM_Sans'] text-[14px] font-medium text-ods-text-primary">
            OG Image
          </Label>

          {/* OG Image Upload/Display */}
          <div className="flex-1 relative">
            {displayImage && !imageError ? (
              <div className="relative group h-full min-h-[280px]">
                <Image
                  src={displayImage}
                  alt="OG Image"
                  fill
                  className="object-contain rounded-lg"
                  onError={() => setImageError(true)}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-lg flex items-center justify-center gap-2">
                  {onOgImageUpload && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef?.click()}
                      disabled={disabled || isUploading}
                      className="bg-white text-black hover:bg-gray-100 rounded-full opacity-0 group-hover:opacity-100"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onOgImageUrlChange('')}
                    disabled={disabled}
                    className="bg-white text-black hover:bg-gray-100 rounded-full opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="h-full min-h-[280px] border-2 border-dashed border-ods-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-ods-accent transition-colors bg-ods-bg-hover"
                onClick={() => onOgImageUpload && fileInputRef?.click()}
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-ods-accent" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-ods-text-secondary mb-2" />
                    <span className="text-sm text-ods-text-secondary font-['DM_Sans']">
                      {onOgImageUpload ? 'Click to upload OG image' : 'No image'}
                    </span>
                  </>
                )}
              </div>
            )}

            {onOgImageUpload && (
              <input
                ref={setFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={disabled || isUploading}
              />
            )}
          </div>

          {!ogImageUrl && featuredImage && (
            <p className="text-[11px] text-ods-accent font-['DM_Sans']">
              Using featured image
            </p>
          )}
        </div>
      </div>

      {/* Live Preview */}
      <div className="pt-4 border-t border-ods-border">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-ods-text-secondary" />
          <span className="font-['DM_Sans'] text-[12px] font-medium text-ods-text-secondary">
            Social Media Preview
          </span>
        </div>

        {/* OG Card Preview */}
        <div className="bg-ods-bg border border-ods-border rounded-lg overflow-hidden max-w-[500px]">
          {/* Image Section */}
          <div className="relative w-full h-[260px] bg-ods-bg-active">
            {displayImage && !imageError ? (
              <Image
                src={displayImage}
                alt={displayTitle}
                fill
                className="object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Globe className="w-12 h-12 text-ods-text-secondary mx-auto mb-2" />
                  <p className="text-ods-text-secondary text-sm font-['DM_Sans']">No preview image</p>
                </div>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-4 space-y-2">
            {/* Domain */}
            <div className="flex items-center gap-1">
              <ExternalLink className="w-3 h-3 text-ods-text-secondary" />
              <span className="font-['DM_Sans'] text-[11px] text-ods-text-secondary uppercase tracking-wide">
                {domain}
              </span>
            </div>

            {/* Title */}
            <h3 className="font-['DM_Sans'] text-[16px] font-semibold text-ods-text-primary leading-[1.3] line-clamp-2">
              {displayTitle}
            </h3>

            {/* Description */}
            <p className="font-['DM_Sans'] text-[14px] text-ods-text-secondary leading-[1.4] line-clamp-3">
              {displayDescription}
            </p>
          </div>
        </div>

        {/* Fallback Indicators */}
        <div className="space-y-1 mt-3">
          {!seoTitle.trim() && title && (
            <p className="font-['DM_Sans'] text-[11px] text-ods-accent">
              • Using title as SEO title
            </p>
          )}
          {!seoDescription.trim() && summary && (
            <p className="font-['DM_Sans'] text-[11px] text-ods-accent">
              • Using summary as SEO description
            </p>
          )}
          {!ogImageUrl.trim() && featuredImage.trim() && (
            <p className="font-['DM_Sans'] text-[11px] text-ods-accent">
              • Using featured image as OG image
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
