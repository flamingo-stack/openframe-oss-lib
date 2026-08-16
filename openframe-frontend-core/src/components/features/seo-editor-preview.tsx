"use client";

import { useState } from 'react';
import { Input, Textarea, Label, Button, Badge, Field } from '../ui';
import { ConfidenceBadge } from '../features';
import { Globe, ExternalLink, Upload, X, Loader2, Sparkles } from 'lucide-react';
import { AIGeneratedBadge } from '../ui/ai-generated-badge';
import { cn } from '../../utils';
import Image from '../../embed-shims/next-image';
// SSOT for the field cap (server-safe constant). The seo_title renders as the
// page <title> verbatim (no brand suffix), so this is the full ~60-char budget.
import { SEO_TITLE_MAX_LENGTH } from '../../utils/seo-title';
import { SEO_DESCRIPTION_MAX_LENGTH } from '../../utils/seo-description';

/** SEO Description textarea and the OG upload box sit side by side on desktop —
 *  ONE height constant for both, so the pair stays flush instead of each
 *  picking its own (`rows` on one, `min-h` on the other, drifting apart). */
const SEO_MEDIA_BOX_HEIGHT = 'h-[280px]'

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

  // AI confidence scores
  aiConfidenceSeoTitle?: number;
  aiConfidenceSeoDescription?: number;
  aiConfidenceSeoKeywords?: number;

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
  aiConfidenceSeoTitle,
  aiConfidenceSeoDescription,
  aiConfidenceSeoKeywords,
  domain = 'openmsp.ai',
  disabled = false,
  className = ''
}: SEOEditorPreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);

  // SEO title length state — alerts the editor when the title would render too long.
  const seoTitleLength = (seoTitle || '').length;
  const seoTitleTooLong = seoTitleLength > SEO_TITLE_MAX_LENGTH;

  // SEO description length state — the column is varchar(160); flag over-length so
  // the editor (or a programmatically-set value) can be brought within budget.
  const seoDescriptionLength = (seoDescription || '').length;
  const seoDescriptionTooLong = seoDescriptionLength > SEO_DESCRIPTION_MAX_LENGTH;

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
      <h3 className="text-h5 text-ods-text-primary">
        SEO & Open Graph
      </h3>

      {/* SEO Title & Keywords - Same Row. EVERY field goes through `Field`, so
          both columns share one label-row geometry; badges + the char counter
          ride the label row (labelExtras / labelEnd) instead of adding stray
          rows that misalign siblings. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Field
            label="SEO Title"
            error={seoTitleTooLong ? `Too long: search engines may truncate this title (keep it under ${SEO_TITLE_MAX_LENGTH})` : null}
            labelExtras={
              aiConfidenceSeoTitle !== undefined ? (
                <>
                  <AIGeneratedBadge />
                  <ConfidenceBadge confidence={aiConfidenceSeoTitle} showLabel={true} showPercentage={true} size="sm" />
                </>
              ) : undefined
            }
            labelEnd={
              <span className={cn('text-h6 tabular-nums', seoTitleTooLong ? 'text-ods-error font-semibold' : 'text-ods-text-secondary')}>
                {seoTitleLength}/{SEO_TITLE_MAX_LENGTH}
              </span>
            }
          >
            {(f) => (
              <Input
                {...f}
                value={seoTitle || ''}
                onChange={(e) => onSeoTitleChange(e.target.value)}
                disabled={disabled}
                maxLength={SEO_TITLE_MAX_LENGTH}
                invalid={seoTitleTooLong}
                placeholder="Enter SEO meta title..."
                className="bg-ods-bg border-ods-border text-ods-text-primary"
              />
            )}
          </Field>
          {!seoTitle && title && (
            <p className="text-h6 text-ods-accent">
              Auto-populated from title
            </p>
          )}
        </div>

        <Field
          label="SEO Keywords"
          labelExtras={
            aiConfidenceSeoKeywords !== undefined ? (
              <>
                <AIGeneratedBadge />
                <ConfidenceBadge confidence={aiConfidenceSeoKeywords} showLabel={true} showPercentage={true} size="sm" />
              </>
            ) : undefined
          }
        >
          {(f) => (
            <Input
              {...f}
              value={seoKeywords || ''}
              onChange={(e) => onSeoKeywordsChange(e.target.value)}
              disabled={disabled}
              placeholder="Enter SEO keywords..."
              className="bg-ods-bg border-ods-border text-ods-text-primary"
            />
          )}
        </Field>
      </div>

      {/* SEO Description & OG Image - Same Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Field
            label="SEO Description"
            error={seoDescriptionTooLong ? `Too long: search engines may truncate this description (keep it under ${SEO_DESCRIPTION_MAX_LENGTH})` : null}
            labelExtras={
              aiConfidenceSeoDescription !== undefined ? (
                <>
                  <AIGeneratedBadge />
                  <ConfidenceBadge confidence={aiConfidenceSeoDescription} showLabel={true} showPercentage={true} size="sm" />
                </>
              ) : undefined
            }
            labelEnd={
              <span className={cn('text-h6 tabular-nums', seoDescriptionTooLong ? 'text-ods-error font-semibold' : 'text-ods-text-secondary')}>
                {seoDescriptionLength}/{SEO_DESCRIPTION_MAX_LENGTH}
              </span>
            }
          >
            {(f) => (
              <Textarea
                {...f}
                value={seoDescription || ''}
                onChange={(e) => onSeoDescriptionChange(e.target.value)}
                disabled={disabled}
                maxLength={SEO_DESCRIPTION_MAX_LENGTH}
                invalid={seoDescriptionTooLong}
                placeholder="Enter SEO meta description..."
                className={cn('bg-ods-bg border-ods-border text-ods-text-primary resize-none', SEO_MEDIA_BOX_HEIGHT)}
              />
            )}
          </Field>
          {!seoDescription && summary && (
            <p className="text-h6 text-ods-accent">
              Auto-populated from summary
            </p>
          )}
        </div>

        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          {/* Group label for the upload widget — Field's exact label treatment,
              so the OG column's label row aligns with the Description Field. */}
          <Label variant="small" className="text-ods-text-primary">
            OG Image
          </Label>

          {/* OG Image Upload/Display — pt matches Field's label→control offset
              so this box's top aligns with the Description textarea's top. */}
          <div className="relative pt-[var(--spacing-system-xxs)]">
            {displayImage && !imageError ? (
              <div className={cn("relative group", SEO_MEDIA_BOX_HEIGHT)}>
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
                className={cn(SEO_MEDIA_BOX_HEIGHT, "border-2 border-dashed border-ods-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-ods-accent transition-colors bg-ods-bg-hover")}
                onClick={() => onOgImageUpload && fileInputRef?.click()}
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-ods-accent" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-ods-text-secondary mb-2" />
                    <span className="text-h6 text-ods-text-secondary">
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
            <p className="text-h6 text-ods-accent">
              Using featured image
            </p>
          )}
        </div>
      </div>

      {/* Live Preview */}
      <div className="pt-4 border-t border-ods-border">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-ods-text-secondary" />
          <span className="text-h6 text-ods-text-secondary">
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
                  <p className="text-ods-text-secondary text-h6">No preview image</p>
                </div>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-4 space-y-2">
            {/* Domain */}
            <div className="flex items-center gap-1">
              <ExternalLink className="w-3 h-3 text-ods-text-secondary" />
              <span className="text-h6 text-ods-text-secondary uppercase">
                {domain}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-h6 font-semibold text-ods-text-primary line-clamp-2">
              {displayTitle}
            </h3>

            {/* Description */}
            <p className="text-h6 text-ods-text-secondary line-clamp-3">
              {displayDescription}
            </p>
          </div>
        </div>

        {/* Fallback Indicators */}
        <div className="space-y-1 mt-3">
          {!seoTitle.trim() && title && (
            <p className="text-h6 text-ods-accent">
              • Using title as SEO title
            </p>
          )}
          {!seoDescription.trim() && summary && (
            <p className="text-h6 text-ods-accent">
              • Using summary as SEO description
            </p>
          )}
          {!ogImageUrl.trim() && featuredImage.trim() && (
            <p className="text-h6 text-ods-accent">
              • Using featured image as OG image
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
