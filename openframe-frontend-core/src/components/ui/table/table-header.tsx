'use client'

import React from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../../utils/cn'
import { Checkbox } from '../checkbox'
import { FilterIcon } from '../../icons'
import { FiltersDropdown, type FilterSection } from '../../features'
import type { TableHeaderProps, TableColumn } from './types'

export function TableHeader<T = any>({
  columns,
  className,
  sortBy,
  sortDirection,
  onSort,
  filters,
  onFilterChange,
  showFilters,
  selectable,
  allSelected,
  someSelected,
  onSelectAll
}: TableHeaderProps<T>) {
  const getAlignment = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'justify-center'
      case 'right':
        return 'justify-end'
      default:
        return 'justify-start'
    }
  }

  const handleSort = (column: TableColumn<T>) => {
    if (!column.sortable || !onSort) return
    
    const columnKey = column.sortKey || column.key
    let newDirection: 'asc' | 'desc' = 'asc'
    
    if (sortBy === columnKey) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    }
    
    onSort(columnKey, newDirection)
  }

  const getSortIcon = (column: TableColumn<T>) => {
    if (!column.sortable) return null
    
    const columnKey = column.sortKey || column.key
    const isActive = sortBy === columnKey
    
    if (!isActive) {
      return <ChevronsUpDown className="w-4 h-4 text-[#888888]" />
    }
    
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-[#FFD951]" />
      : <ChevronDown className="w-4 h-4 text-[#FFD951]" />
  }

  return (
    <>
      {/* Mobile Filter Header */}
      {showFilters && columns.filter(column => column.filterable && column.filterOptions && column.hideOnMobile !== true).length > 0 && (
        <div className="flex md:hidden gap-3 items-center justify-start px-4 py-3 bg-[#161616] overflow-x-auto">
          {columns
            .filter(column => column.filterable && column.filterOptions && column.hideOnMobile !== true)
            .map((column) => (
              <div key={column.key} className="flex gap-2 items-center shrink-0">
                <span className="font-['Azeret_Mono'] font-medium text-[12px] leading-[16px] text-[#888888] uppercase tracking-[-0.24px] whitespace-nowrap">
                  {column.label}
                </span>
                <FiltersDropdown
                  triggerElement={
                    <div
                      className={cn(
                        "p-0.5 rounded transition-all duration-200 cursor-pointer",
                        (filters?.[column.key]?.length || 0) > 0
                          ? "bg-[#FFD951] hover:bg-[#FFD951]/80"
                          : "hover:bg-[#2a2a2a]"
                      )}
                      aria-label={`Filter by ${column.label}`}
                    >
                      <FilterIcon 
                        className={cn(
                          "w-4 h-4 transition-colors",
                          (filters?.[column.key]?.length || 0) > 0
                            ? "text-[#161616]"
                            : "text-[#888888] hover:text-[#fafafa]"
                        )}
                      />
                    </div>
                  }
                  sections={[
                    {
                      id: column.key,
                      title: column.label,
                      type: 'checkbox',
                      options: column.filterOptions,
                      allowSelectAll: true
                    } as FilterSection
                  ]}
                  onApply={(appliedFilters) => {
                    if (onFilterChange) {
                      onFilterChange({
                        ...filters,
                        [column.key]: appliedFilters[column.key] || []
                      })
                    }
                  }}
                  onReset={() => {
                    if (onFilterChange) {
                      const newFilters = { ...filters }
                      delete newFilters[column.key]
                      onFilterChange(newFilters)
                    }
                  }}
                  currentFilters={{ [column.key]: filters?.[column.key] || [] }}
                  placement="bottom-start"
                  responsive={true}
                />
              </div>
            ))}
        </div>
      )}
      
      {/* Desktop Header */}
      <div 
        className={cn(
          'hidden md:flex items-center gap-4 px-4 py-3 bg-[#161616]',
          className
        )}
      >
        {/* Selection checkbox */}
        {selectable && (
          <div className="flex items-center justify-center w-10 shrink-0">
            <Checkbox
              checked={allSelected || (someSelected && !allSelected) ? true : false}
              onCheckedChange={onSelectAll}
              className="border-[#3a3a3a]"
            />
          </div>
        )}

        {columns.map((column) => (
          <div
            key={column.key}
            className={cn(
              'flex gap-2 items-center',
              getAlignment(column.align),
              column.width || 'flex-1 min-w-0',
              column.className
            )}
          >
            <div
              className={cn(
                'flex gap-2 items-center',
                column.sortable && 'cursor-pointer hover:text-[#fafafa] transition-colors'
              )}
              onClick={() => handleSort(column)}
            >
              {column.renderHeader ? (
                column.renderHeader()
              ) : (
                <>
                  <span className="font-['Azeret_Mono'] font-medium text-[12px] leading-[16px] text-[#888888] uppercase tracking-[-0.24px]">
                    {column.label}
                  </span>
                  {getSortIcon(column)}
                </>
              )}
            </div>
            
            {/* Filter dropdown for columns with filterOptions */}
            {column.filterable && column.filterOptions && onFilterChange && (
              <FiltersDropdown
                triggerElement={
                  <div
                    className={cn(
                      "p-0.5 rounded transition-all duration-200 cursor-pointer",
                      (filters?.[column.key]?.length || 0) > 0
                        ? "bg-[#FFD951] hover:bg-[#FFD951]/80"
                        : "hover:bg-[#2a2a2a]"
                    )}
                    aria-label={`Filter by ${column.label}`}
                  >
                    <FilterIcon 
                      className={cn(
                        "w-4 h-4 transition-colors",
                        (filters?.[column.key]?.length || 0) > 0
                          ? "text-[#161616]"
                          : "text-[#888888] hover:text-[#fafafa]"
                      )}
                    />
                  </div>
                }
                sections={[
                  {
                    id: column.key,
                    title: column.label,
                    type: 'checkbox',
                    options: column.filterOptions,
                    allowSelectAll: true
                  } as FilterSection
                ]}
                onApply={(appliedFilters) => {
                  onFilterChange({
                    ...filters,
                    [column.key]: appliedFilters[column.key] || []
                  })
                }}
                onReset={() => {
                  const newFilters = { ...filters }
                  delete newFilters[column.key]
                  onFilterChange(newFilters)
                }}
                currentFilters={{ [column.key]: filters?.[column.key] || [] }}
                placement="bottom-start"
                dropdownClassName="min-w-[240px]"
              />
            )}
          </div>
        ))}
      </div>
    </>
  )
}