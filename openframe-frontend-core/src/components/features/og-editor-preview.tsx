"use client";

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
  OGImageUploadComponent: React.ReactNode;

  // OG Preview Component (passed from parent)
  OGPreviewComponent: React.ReactNode;

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
  className = ''
}: OGEditorPreviewProps) {
  return (
    <div className={`space-y-6 p-6 bg-ods-card border border-ods-border rounded-lg ${className}`}>
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
            value={seoTitle}
            onChange={(e) => onSeoTitleChange(e.target.value)}
            disabled={disabled}
            placeholder="Enter SEO meta title..."
            className="bg-[#161616] border-ods-border text-ods-text-primary"
          />
        </div>

        <div className="space-y-2">
          <Label className="font-['DM_Sans'] text-[14px] font-medium text-ods-text-primary">
            SEO Keywords
          </Label>
          <Input
            value={seoKeywords}
            onChange={(e) => onSeoKeywordsChange(e.target.value)}
            disabled={disabled}
            placeholder="Enter SEO keywords..."
            className="bg-[#161616] border-ods-border text-ods-text-primary"
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
            value={seoDescription}
            onChange={(e) => onSeoDescriptionChange(e.target.value)}
            disabled={disabled}
            placeholder="Enter SEO meta description..."
            className="bg-[#161616] border-ods-border text-ods-text-primary flex-1 resize-none"
            rows={6}
          />
        </div>

        <div className="space-y-2 flex flex-col h-full">
          <Label className="font-['DM_Sans'] text-[14px] font-medium text-ods-text-primary">
            OG Image
          </Label>
          <div className="flex-1">
            {OGImageUploadComponent}
          </div>
        </div>
      </div>

      {/* OG Preview */}
      <div className="pt-4 border-t border-ods-border">
        {OGPreviewComponent}
      </div>
    </div>
  );
}
