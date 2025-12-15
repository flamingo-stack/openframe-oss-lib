'use client'

import React from 'react'
import { Folder, File, FileText, Image, FileVideo, FileAudio, FileCode, FileArchive } from 'lucide-react'
import { cn } from '../../../utils/cn'
import type { FileIconProps } from './types'

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6'
}

const getFileIcon = (extension?: string) => {
  if (!extension) return File
  
  const ext = extension.toLowerCase()
  
  // Document files
  if (['txt', 'doc', 'docx', 'pdf', 'rtf'].includes(ext)) return FileText
  
  // Image files
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return Image
  
  // Video files
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'].includes(ext)) return FileVideo
  
  // Audio files
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(ext)) return FileAudio
  
  // Code files
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'html', 'css', 'json', 'xml'].includes(ext)) return FileCode
  
  // Archive files
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return FileArchive
  
  return File
}

export function FileIcon({ type, extension, className, size = 'md' }: FileIconProps) {
  const Icon = type === 'folder' ? Folder : getFileIcon(extension)
  
  return (
    <Icon 
      className={cn(
        sizeMap[size],
        type === 'folder' ? 'text-ods-accent' : 'text-ods-text-secondary',
        className
      )}
    />
  )
}