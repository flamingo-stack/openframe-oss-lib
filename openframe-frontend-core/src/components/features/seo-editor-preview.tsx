'use client';

import { Globe, ExternalLink, Upload, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import Image from '../../embed-shims/next-image';
import { cn } from '../../utils';
import { SEO_DESCRIPTION_MAX_LENGTH } from '../../utils/seo-description';
// SSOT for the field cap (server-safe constant). The seo_title renders as the
// page <title> verbatim (no brand suffix), so this is the full ~60-char budget.
import { SEO_TITLE_MAX_LENGTH } from '../../utils/seo-title';
import { Input, Textarea, Label, Button, Field } from '../ui';
import { AIGeneratedBadge } from '../ui/ai-generated-badge';
import { ConfidenceBadge } from './ai-enrich/ConfidenceBadge';

/** SEO Description textarea and the OG upload box sit side by side on desktop —
 *  ONE height constant for both, so the pair stays flush instead of each
 *  picking its own (`rows` on one, `min-h` on the other, drifting apart). */
const SEO_MEDIA_BOX_HEIGHT = 'h-[280px]';

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
  className = '',
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

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
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
    <div className={cn('space-y-6 rounded-lg border border-ods-border bg-ods-card p-6', className)}>
      <h3 className="text-ods-text-primary text-h5">SEO & Open Graph</h3>

      {/* SEO Title & Keywords - Same Row. EVERY field goes through `Field`, so
          both columns share one label-row geometry; badges + the char counter
          ride the label row (labelExtras / labelEnd) instead of adding stray
          rows that misalign siblings. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Field
            label="SEO Title"
            error={
              seoTitleTooLong
                ? `Too long: search engines may truncate this title (keep it under ${SEO_TITLE_MAX_LENGTH})`
                : null
            }
            labelExtras={
              aiConfidenceSeoTitle !== undefined ? (
                <>
                  <AIGeneratedBadge />
                  <ConfidenceBadge confidence={aiConfidenceSeoTitle} showLabel={true} showPercentage={true} size="sm" />
                </>
              ) : undefined
            }
            labelEnd={
              <span
                className={cn(
                  'tabular-nums text-h6',
                  seoTitleTooLong ? 'font-semibold text-ods-error' : 'text-ods-text-secondary',
                )}
              >
                {seoTitleLength}/{SEO_TITLE_MAX_LENGTH}
              </span>
            }
          >
            {f => (
              <Input
                {...f}
                value={seoTitle || ''}
                onChange={e => onSeoTitleChange(e.target.value)}
                disabled={disabled}
                maxLength={SEO_TITLE_MAX_LENGTH}
                invalid={seoTitleTooLong}
                placeholder="Enter SEO meta title..."
                className="border-ods-border bg-ods-bg text-ods-text-primary"
              />
            )}
          </Field>
          {!seoTitle && title && <p className="text-ods-accent text-h6">Auto-populated from title</p>}
        </div>

        <Field
          label="SEO Keywords"
          labelExtras={
            aiConfidenceSeoKeywords !== undefined ? (
              <>
                <AIGeneratedBadge />
                <ConfidenceBadge
                  confidence={aiConfidenceSeoKeywords}
                  showLabel={true}
                  showPercentage={true}
                  size="sm"
                />
              </>
            ) : undefined
          }
        >
          {f => (
            <Input
              {...f}
              value={seoKeywords || ''}
              onChange={e => onSeoKeywordsChange(e.target.value)}
              disabled={disabled}
              placeholder="Enter SEO keywords..."
              className="border-ods-border bg-ods-bg text-ods-text-primary"
            />
          )}
        </Field>
      </div>

      {/* SEO Description & OG Image - Same Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Field
            label="SEO Description"
            error={
              seoDescriptionTooLong
                ? `Too long: search engines may truncate this description (keep it under ${SEO_DESCRIPTION_MAX_LENGTH})`
                : null
            }
            labelExtras={
              aiConfidenceSeoDescription !== undefined ? (
                <>
                  <AIGeneratedBadge />
                  <ConfidenceBadge
                    confidence={aiConfidenceSeoDescription}
                    showLabel={true}
                    showPercentage={true}
                    size="sm"
                  />
                </>
              ) : undefined
            }
            labelEnd={
              <span
                className={cn(
                  'tabular-nums text-h6',
                  seoDescriptionTooLong ? 'font-semibold text-ods-error' : 'text-ods-text-secondary',
                )}
              >
                {seoDescriptionLength}/{SEO_DESCRIPTION_MAX_LENGTH}
              </span>
            }
          >
            {f => (
              <Textarea
                {...f}
                value={seoDescription || ''}
                onChange={e => onSeoDescriptionChange(e.target.value)}
                disabled={disabled}
                maxLength={SEO_DESCRIPTION_MAX_LENGTH}
                invalid={seoDescriptionTooLong}
                placeholder="Enter SEO meta description..."
                className={cn('resize-none border-ods-border bg-ods-bg text-ods-text-primary', SEO_MEDIA_BOX_HEIGHT)}
              />
            )}
          </Field>
          {!seoDescription && summary && <p className="text-ods-accent text-h6">Auto-populated from summary</p>}
        </div>

        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          {/* Group label for the upload widget — Field's exact label treatment,
              so the OG column's label row aligns with the Description Field. */}
          <Label>OG Image</Label>

          {/* OG Image Upload/Display — pt matches Field's label→control offset
              so this box's top aligns with the Description textarea's top. */}
          <div className="relative pt-[var(--spacing-system-xxs)]">
            {displayImage && !imageError ? (
              <div className={cn('group relative', SEO_MEDIA_BOX_HEIGHT)}>
                <Image
                  src={displayImage}
                  alt="OG Image"
                  fill
                  className="rounded-lg object-contain"
                  onError={() => setImageError(true)}
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black bg-opacity-0 transition-all group-hover:bg-opacity-40">
                  {onOgImageUpload && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef?.click()}
                      disabled={disabled || isUploading}
                      className="rounded-full bg-white text-black opacity-0 hover:bg-gray-100 group-hover:opacity-100"
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
                    className="rounded-full bg-white text-black opacity-0 hover:bg-gray-100 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  SEO_MEDIA_BOX_HEIGHT,
                  'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-ods-border bg-ods-bg-hover transition-colors hover:border-ods-accent',
                )}
                onClick={() => onOgImageUpload && fileInputRef?.click()}
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-ods-accent" />
                ) : (
                  <>
                    <Upload className="mb-2 h-8 w-8 text-ods-text-secondary" />
                    <span className="text-ods-text-secondary text-h6">
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

          {!ogImageUrl && featuredImage && <p className="text-ods-accent text-h6">Using featured image</p>}
        </div>
      </div>

      {/* Live Preview */}
      <div className="border-t border-ods-border pt-4">
        <div className="mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-ods-text-secondary" />
          <span className="text-ods-text-secondary text-h6">Social Media Preview</span>
        </div>

        {/* OG Card Preview */}
        <div className="max-w-[500px] overflow-hidden rounded-lg border border-ods-border bg-ods-bg">
          {/* Image Section */}
          <div className="relative h-[260px] w-full bg-ods-bg-active">
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
                  <Globe className="mx-auto mb-2 h-12 w-12 text-ods-text-secondary" />
                  <p className="text-ods-text-secondary text-h6">No preview image</p>
                </div>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="space-y-2 p-4">
            {/* Domain */}
            <div className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3 text-ods-text-secondary" />
              <span className="uppercase text-ods-text-secondary text-h6">{domain}</span>
            </div>

            {/* Title */}
            <h3 className="line-clamp-2 font-semibold text-ods-text-primary text-h6">{displayTitle}</h3>

            {/* Description */}
            <p className="line-clamp-3 text-ods-text-secondary text-h6">{displayDescription}</p>
          </div>
        </div>

        {/* Fallback Indicators */}
        <div className="mt-3 space-y-1">
          {!seoTitle.trim() && title && <p className="text-ods-accent text-h6">• Using title as SEO title</p>}
          {!seoDescription.trim() && summary && (
            <p className="text-ods-accent text-h6">• Using summary as SEO description</p>
          )}
          {!ogImageUrl.trim() && featuredImage.trim() && (
            <p className="text-ods-accent text-h6">• Using featured image as OG image</p>
          )}
        </div>
      </div>
    </div>
  );
}
