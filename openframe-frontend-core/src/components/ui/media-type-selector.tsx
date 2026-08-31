'use client';

import { Video, Image as ImageIcon, FileText, Archive, CheckSquare, BookOpen, FileType } from 'lucide-react';
import type { ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

export type ResourceMediaType = 'video' | 'png' | 'jpg' | 'svg' | 'document' | 'pdf' | 'zip' | 'guide' | 'checklist';

interface MediaTypeOption {
  value: ResourceMediaType;
  label: string;
  icon: ReactNode;
}

const mediaTypeOptions: MediaTypeOption[] = [
  { value: 'video', label: 'Video', icon: <Video className="h-4 w-4" /> },
  { value: 'png', label: 'PNG Image', icon: <ImageIcon className="h-4 w-4" /> },
  { value: 'jpg', label: 'JPG Image', icon: <ImageIcon className="h-4 w-4" /> },
  { value: 'svg', label: 'SVG Image', icon: <ImageIcon className="h-4 w-4" /> },
  { value: 'pdf', label: 'PDF', icon: <FileType className="h-4 w-4" /> },
  { value: 'document', label: 'Document', icon: <FileText className="h-4 w-4" /> },
  { value: 'zip', label: 'ZIP Archive', icon: <Archive className="h-4 w-4" /> },
  { value: 'guide', label: 'Guide', icon: <BookOpen className="h-4 w-4" /> },
  { value: 'checklist', label: 'Checklist', icon: <CheckSquare className="h-4 w-4" /> },
];

interface MediaTypeSelectorProps {
  value?: ResourceMediaType;
  onValueChange?: (value: ResourceMediaType) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MediaTypeSelector({
  value,
  onValueChange,
  placeholder = 'Select media type',
  className,
  disabled,
}: MediaTypeSelectorProps) {
  return (
    // Remount the Select whenever `value` changes — it reads `defaultValue` at
    // mount, so without a fresh instance an externally-set value never shows.
    // The key is the value itself: the old counter state was bumped from an
    // effect, which remounted the Select on MOUNT too (0 → 1 with nothing
    // changed) and cost an extra render pass on every change to say what the
    // prop already said.
    <Select
      key={value ?? '__unset__'}
      value={value || undefined}
      onValueChange={onValueChange}
      disabled={disabled}
      defaultValue={value}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {mediaTypeOptions.map(option => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {option.icon}
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
