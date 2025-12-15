'use client'

import React, { useMemo } from 'react'
import { cn } from '../../../utils/cn'
import { SearchBar } from '../search-bar'
import { FileManagerBreadcrumb } from './file-manager-breadcrumb'
import { FileManagerActionBar } from './file-manager-action-bar'
import { FileManagerTable } from './file-manager-table'
import type { FileManagerProps, BreadcrumbItem } from './types'

export function FileManager({ 
  files,
  currentPath,
  selectedFiles,
  searchQuery,
  loading = false,
  isSearching = false,
  showCheckboxes = true,
  showSearch = true,
  showActions = true,
  canPaste = false,
  disableSearch = false,
  resultsCount,
  onNavigate,
  onBreadcrumbClick,
  onSearch,
  onSelectFile,
  onSelectAll,
  onFileAction,
  onFileClick,
  onFolderOpen,
  className 
}: FileManagerProps) {
  const breadcrumbItems = useMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = []
    
    items.push({ label: 'Root', path: '' })
    
    if (!currentPath || currentPath === '' || currentPath === '/') {
      return items
    }
    
    const isWindowsPath = currentPath.includes('\\') || /^[A-Za-z]:/.test(currentPath)
    const separator = isWindowsPath ? '\\' : '/'
    
    const parts = currentPath.split(separator).filter(Boolean)
    
    let startIndex = 0
    if (isWindowsPath && parts.length > 0) {
      const driveMatch = parts[0].match(/^([A-Za-z]:)/)
      if (driveMatch) {
        items.push({
          label: driveMatch[1],
          path: driveMatch[1] + separator
        })
        if (parts[0] === driveMatch[1]) {
          startIndex = 1
        } else {
          parts[0] = parts[0].substring(driveMatch[1].length)
        }
      }
    }
    
    let accumulatedPath = ''
    if (isWindowsPath && items.length > 1) {
      accumulatedPath = items[items.length - 1].path
    }
    
    for (let i = startIndex; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue
      
      if (isWindowsPath) {
        accumulatedPath = accumulatedPath.endsWith(separator) 
          ? accumulatedPath + part 
          : accumulatedPath + separator + part
      } else {
        accumulatedPath = accumulatedPath === '' || accumulatedPath === '/'
          ? '/' + part 
          : accumulatedPath + '/' + part
      }
      
      items.push({
        label: part,
        path: accumulatedPath
      })
    }
    
    return items
  }, [currentPath])

  const handleBreadcrumbClick = (path: string) => {
    onBreadcrumbClick?.(path)
    onNavigate?.(path)
  }

  const handleFolderOpen = (file: any) => {
    let newPath: string
    
    if (!currentPath || currentPath === '') {
      if (file.name && /^[A-Za-z]:/.test(file.name)) {
        newPath = file.name + (file.name.endsWith('\\') ? '' : '\\')
      } else {
        newPath = file.name
      }
    } else {
      const separator = currentPath.includes('\\') ? '\\' : '/'
      
      if (currentPath === '/') {
        newPath = '/' + file.name
      } else if (currentPath.endsWith(separator)) {
        newPath = currentPath + file.name
      } else {
        newPath = currentPath + separator + file.name
      }
    }
    
    onFolderOpen?.(file)
    onNavigate?.(newPath)
  }

  const handleSelectAll = (selected: boolean) => {
    onSelectAll?.(selected)
  }

  const handleSelectFile = (fileId: string, selected: boolean) => {
    onSelectFile?.(fileId, selected)
  }

  return (
    <div className={cn('flex flex-col h-full bg-ods-bg', className)}>
      <div className="flex-1 flex flex-col py-6 space-y-6 min-h-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <FileManagerBreadcrumb
            className="flex-1 min-w-0"
            items={breadcrumbItems}
            onItemClick={handleBreadcrumbClick}
          />
          
          {showActions && (
            <FileManagerActionBar
              className="flex-shrink-0"
              canPaste={canPaste}
              hasSelection={selectedFiles.length > 0}
              onNewFolder={() => onFileAction?.('new-folder')}
              onPaste={() => onFileAction?.('paste')}
              onCopy={() => onFileAction?.('copy')}
              onCut={() => onFileAction?.('cut')}
              onUpload={() => onFileAction?.('upload')}
              onSelectAll={() => handleSelectAll(true)}
            />
          )}
        </div>
        
        {showSearch && (
          <SearchBar
            value={searchQuery}
            onSubmit={onSearch}
            loading={isSearching}
            disabled={disableSearch}
          />
        )}
        
        <div className="flex-1 min-h-0">
          <FileManagerTable
            files={files}
            selectedFiles={selectedFiles}
            resultsCount={resultsCount || files.length}
            showCheckboxes={showCheckboxes}
            loading={loading}
            isSearchResult={!!searchQuery}
            onSelectFile={handleSelectFile}
            onSelectAll={handleSelectAll}
            onFileClick={onFileClick}
            onFolderOpen={handleFolderOpen}
            onFileAction={onFileAction}
          />
        </div>
      </div>
    </div>
  )
}