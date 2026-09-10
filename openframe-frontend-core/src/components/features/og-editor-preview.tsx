'use client';

import type { ReactNode } from 'react';
import { Input, Textarea, Label } from '../ui';

export interface OGEditorPreviewProps {
  // SEO fields
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  ogImageUrl: string;

  // Auto-populate sources
  title: string;
  summary: string;
  featuredImage: string;
  categories?: Array<{ name: string; slug: string }>;

  // Change handlers
  onSeoTitleChange: (value: string) => void;
  onSeoDescriptionChange: (value: string) => void;
  onSeoKeywordsChange: (value: string) => void;
  onOgImageUrlChange: (value: string) => void;

  // OG Image Upload Component (passed from parent)
  OGImageUploadComponent: ReactNode;

  // OG Preview Component (passed from parent)
  OGPreviewComponent: ReactNode;

  disabled?: boolean;
  className?: string;
}

/**
 * Unified SEO & Open Graph Editor with Preview
 * Used across blog posts, case studies, and product releases
 * Combines SEO fields, OG image upload, and preview in one component
 */
export function OGEditorPreview({
  seoTitle,
  seoDescription,
  seoKeywords,
  onSeoTitleChange,
  onSeoDescriptionChange,
  onSeoKeywordsChange,
  OGImageUploadComponent,
  OGPreviewComponent,
  disabled = false,
  className = '',
}: OGEditorPreviewProps) {
  return (
    <div className={`space-y-6 rounded-lg border border-ods-border bg-ods-card p-6 ${className}`}>
      <h3 className="text-ods-text-primary text-h5">SEO & Open Graph</h3>

      {/* SEO Title & Keywords - Same Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>SEO Title</Label>
          <Input
            value={seoTitle}
            onChange={e => onSeoTitleChange(e.target.value)}
            disabled={disabled}
            placeholder="Enter SEO meta title..."
            className="border-ods-border bg-ods-bg text-ods-text-primary"
          />
        </div>

        <div className="space-y-2">
          <Label>SEO Keywords</Label>
          <Input
            value={seoKeywords}
            onChange={e => onSeoKeywordsChange(e.target.value)}
            disabled={disabled}
            placeholder="Enter SEO keywords..."
            className="border-ods-border bg-ods-bg text-ods-text-primary"
          />
        </div>
      </div>

      {/* SEO Description & OG Image - Same Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex h-full flex-col space-y-2">
          <Label>SEO Description</Label>
          <Textarea
            value={seoDescription}
            onChange={e => onSeoDescriptionChange(e.target.value)}
            disabled={disabled}
            placeholder="Enter SEO meta description..."
            className="flex-1 resize-none border-ods-border bg-ods-bg text-ods-text-primary"
            rows={6}
          />
        </div>

        <div className="flex h-full flex-col space-y-2">
          <Label>OG Image</Label>
          <div className="flex-1">{OGImageUploadComponent}</div>
        </div>
      </div>

      {/* OG Preview */}
      <div className="border-t border-ods-border pt-4">{OGPreviewComponent}</div>
    </div>
  );
}
