"use client"

import * as React from "react"
import { Video, Image, FileText, Archive, CheckSquare, BookOpen, FileType } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"

export type MediaType = 'video' | 'png' | 'jpg' | 'svg' | 'document' | 'pdf' | 'zip' | 'guide' | 'checklist'

interface MediaTypeOption {
  value: MediaType
  label: string
  icon: React.ReactNode
}

const mediaTypeOptions: MediaTypeOption[] = [
  { value: 'video', label: 'Video', icon: <Video className="h-4 w-4" /> },
  { value: 'png', label: 'PNG Image', icon: <Image className="h-4 w-4" /> },
  { value: 'jpg', label: 'JPG Image', icon: <Image className="h-4 w-4" /> },
  { value: 'svg', label: 'SVG Image', icon: <Image className="h-4 w-4" /> },
  { value: 'pdf', label: 'PDF', icon: <FileType className="h-4 w-4" /> },
  { value: 'document', label: 'Document', icon: <FileText className="h-4 w-4" /> },
  { value: 'zip', label: 'ZIP Archive', icon: <Archive className="h-4 w-4" /> },
  { value: 'guide', label: 'Guide', icon: <BookOpen className="h-4 w-4" /> },
  { value: 'checklist', label: 'Checklist', icon: <CheckSquare className="h-4 w-4" /> },
]

interface MediaTypeSelectorProps {
  value?: MediaType
  onValueChange?: (value: MediaType) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function MediaTypeSelector({
  value,
  onValueChange,
  placeholder = "Select media type",
  className,
  disabled
}: MediaTypeSelectorProps) {
  // Force re-render with key to ensure Select updates
  const [key, setKey] = React.useState(0);
  
  React.useEffect(() => {
    // Force re-render when value changes
    setKey(prev => prev + 1);
  }, [value]);
  
  return (
    <Select 
      key={key}
      value={value || undefined} 
      onValueChange={onValueChange} 
      disabled={disabled}
      defaultValue={value}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {mediaTypeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {option.icon}
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}