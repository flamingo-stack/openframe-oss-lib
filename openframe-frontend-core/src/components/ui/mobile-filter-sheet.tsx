'use client'

import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '../../utils/cn'
import { Arrow01DownIcon, Arrow01UpIcon, SwitchVrIcon } from '../icons-v2-generated'
import { Button } from './button'
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from './modal'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from './sheet'
import type { TableFilters } from './table/types'

export interface MobileFilterOption {
  id: string
  label: string
  count?: number
}

export interface FilterGroup {
  id: string
  title: string
  options: MobileFilterOption[]
}

export interface SortableColumn {
  key: string
  label: string
  sortKey?: string
}

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  columns: SortableColumn[]
  sortBy?: string
  sortDirection?: SortDirection
  title?: string
}

export interface MobileFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  filterGroups: FilterGroup[]
  onFilterChange: (filters: TableFilters) => void
  currentFilters: TableFilters
  resetButtonText?: string
  applyButtonText?: string
  className?: string
  sortConfig?: SortConfig
  onSort?: (column: string, direction: SortDirection) => void
  onSortClear?: (column: string) => void
}

interface FilterCheckboxItemProps {
  option: MobileFilterOption
  checked: boolean
  onChange: (checked: boolean) => void
}

function FilterCheckboxItem({ option, checked, onChange }: FilterCheckboxItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-3 bg-ods-card border-b border-ods-border',
        'cursor-pointer transition-colors hover:bg-ods-bg-hover'
      )}
      onClick={() => onChange(!checked)}
    >
      <CheckboxPrimitive.Root
        checked={checked}
        onCheckedChange={(checked) => onChange(checked === true)}
        className={cn(
          'h-6 w-6 shrink-0 rounded-[6px] border-2',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
          checked
            ? 'bg-ods-accent border-ods-accent'
            : 'bg-ods-card border-ods-text-secondary'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center">
          <Check className="h-3.5 w-3.5 text-ods-bg" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <span className="flex-1 text-sm font-medium text-ods-text-primary font-['DM_Sans']">
        {option.label}
      </span>
      {option.count !== undefined && (
        <span className="text-xs text-ods-text-secondary font-medium font-['DM_Sans']">
          {option.count.toLocaleString()}
        </span>
      )}
    </div>
  )
}


interface SortColumnItemProps {
  column: SortableColumn
  currentDirection?: SortDirection
  onSort: (direction: SortDirection) => void
  onClear?: () => void
  isLast?: boolean
}

function SortColumnItem({ column, currentDirection, onSort, onClear, isLast }: SortColumnItemProps) {
  const handleClick = () => {
    if (!currentDirection) {
      onSort('asc')
    } else if (currentDirection === 'asc') {
      onSort('desc')
    } else {
      if (onClear) {
        onClear()
      } else {
        onSort('asc')
      }
    }
  }

  const getSortIcon = () => {
    if (currentDirection === 'asc') {
      return <Arrow01UpIcon className="w-4 h-4 text-ods-accent" />
    }
    if (currentDirection === 'desc') {
      return <Arrow01DownIcon className="w-4 h-4 text-ods-accent" />
    }
    return <SwitchVrIcon className="w-4 h-4 text-ods-text-secondary" />
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-center justify-between gap-2 p-3 bg-ods-card w-full',
        'cursor-pointer transition-colors hover:bg-ods-bg-hover text-left',
        !isLast && 'border-b border-ods-border'
      )}
    >
      <span className={cn(
        'flex-1 text-sm font-medium font-[\'DM_Sans\']',
        currentDirection ? 'text-ods-text-primary' : 'text-ods-text-secondary'
      )}>
        {column.label}
      </span>
      {getSortIcon()}
    </div>
  )
}

export function MobileFilterSheet({
  open,
  onOpenChange,
  title = 'Sort and Filter',
  filterGroups,
  onFilterChange,
  currentFilters = {},
  resetButtonText = 'Reset Filters',
  applyButtonText = 'Apply Filters',
  className,
  sortConfig,
  onSort,
  onSortClear
}: MobileFilterSheetProps) {
  const [selectedFilters, setSelectedFilters] = useState<TableFilters>(() => {
    return { ...currentFilters }
  })

  useEffect(() => {
    if (open) {
      setSelectedFilters({ ...currentFilters })
    }
  }, [open, JSON.stringify(currentFilters)])

  const handleFilterToggle = (groupId: string, optionId: string, checked: boolean) => {
    setSelectedFilters((prev: TableFilters) => {
      const currentGroupFilters = prev[groupId] || []
      let updatedGroupFilters: string[]

      if (checked) {
        updatedGroupFilters = currentGroupFilters.includes(optionId)
          ? currentGroupFilters
          : [...currentGroupFilters, optionId]
      } else {
        updatedGroupFilters = currentGroupFilters.filter((id: string) => id !== optionId)
      }

      if (updatedGroupFilters.length > 0) {
        return {
          ...prev,
          [groupId]: updatedGroupFilters
        }
      } else {
        const newFilters = { ...prev }
        delete newFilters[groupId]
        return newFilters
      }
    })
  }

  const handleReset = () => {
    onFilterChange({})
    onOpenChange(false)
  }

  const handleApply = () => {
    onFilterChange(selectedFilters)
    onOpenChange(false)
  }

  const handleColumnSort = (columnKey: string, direction: SortDirection) => {
    if (!onSort) return
    onSort(columnKey, direction)
  }

  const handleColumnClear = (columnKey: string) => {
    if (onSortClear) {
      onSortClear(columnKey)
    }
  }

  const getColumnDirection = (columnKey: string): SortDirection | undefined => {
    if (sortConfig?.sortBy === columnKey) {
      return sortConfig.sortDirection
    }
    return undefined
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          'bg-ods-bg border-t border-ods-border p-6 max-h-[85vh] overflow-y-auto',
          className
        )}
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-2xl font-semibold text-ods-text-primary font-['Azeret_Mono'] tracking-[-0.48px]">
            {title}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4">
          {sortConfig && sortConfig.columns.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ods-text-secondary uppercase tracking-[-0.24px] font-['Azeret_Mono']">
                {sortConfig.title || 'Sort By'}
              </span>
              <div className="rounded-[6px] border border-ods-border overflow-hidden">
                {sortConfig.columns.map((column, index) => (
                  <SortColumnItem
                    key={column.key}
                    column={column}
                    currentDirection={getColumnDirection(column.key)}
                    onSort={(direction) => handleColumnSort(column.key, direction)}
                    onClear={onSortClear ? () => handleColumnClear(column.key) : undefined}
                    isLast={index === sortConfig.columns.length - 1}
                  />
                ))}
              </div>
            </div>
          )}

          {filterGroups.map((group) => {
            const groupSelection = selectedFilters[group.id] || []

            return (
              <div key={group.id} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ods-text-secondary uppercase tracking-[-0.24px] font-['Azeret_Mono']">
                  {group.title}
                </span>
                <div className="rounded-[6px] border border-ods-border overflow-hidden">
                  {group.options.map((option, index) => {
                    const isChecked = groupSelection.includes(option.id)

                    return (
                      <div
                        key={option.id}
                        className={cn(index === group.options.length - 1 && 'border-b-0')}
                      >
                        <FilterCheckboxItem
                          option={option}
                          checked={isChecked}
                          onChange={(checked) => handleFilterToggle(group.id, option.id, checked)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-4 mt-6">
          <Button
            variant="outline"
            className="flex-1 h-11"
            onClick={handleReset}
          >
            {resetButtonText}
          </Button>
          <Button
            variant="primary"
            className="flex-1 h-11"
            onClick={handleApply}
          >
            {applyButtonText}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export interface MobileFilterModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  filterGroups: FilterGroup[]
  onFilterChange: (filters: TableFilters) => void
  currentFilters?: TableFilters
  resetButtonText?: string
  applyButtonText?: string
  className?: string
  sortConfig?: SortConfig
  onSort?: (column: string, direction: SortDirection) => void
  onSortClear?: (column: string) => void
}

export function MobileFilterModal({
  isOpen,
  onClose,
  title = 'Sort and Filter',
  filterGroups,
  onFilterChange,
  currentFilters = {},
  resetButtonText = 'Reset Filters',
  applyButtonText = 'Apply Filters',
  className,
  sortConfig,
  onSort,
  onSortClear
}: MobileFilterModalProps) {
  const [selectedFilters, setSelectedFilters] = useState<TableFilters>(() => {
    return { ...currentFilters }
  })

  useEffect(() => {
    if (isOpen) {
      setSelectedFilters({ ...currentFilters })
    }
  }, [isOpen, JSON.stringify(currentFilters)])

  const handleFilterToggle = (groupId: string, optionId: string, checked: boolean) => {
    setSelectedFilters((prev: TableFilters) => {
      const currentGroupFilters = prev[groupId] || []
      let updatedGroupFilters: string[]

      if (checked) {
        updatedGroupFilters = currentGroupFilters.includes(optionId)
          ? currentGroupFilters
          : [...currentGroupFilters, optionId]
      } else {
        updatedGroupFilters = currentGroupFilters.filter((id: string) => id !== optionId)
      }

      if (updatedGroupFilters.length > 0) {
        return {
          ...prev,
          [groupId]: updatedGroupFilters
        }
      } else {
        const newFilters = { ...prev }
        delete newFilters[groupId]
        return newFilters
      }
    })
  }

  const handleReset = () => {
    onFilterChange({})
    onClose()
  }

  const handleApply = () => {
    onFilterChange(selectedFilters)
    onClose()
  }

  const handleColumnSort = (columnKey: string, direction: SortDirection) => {
    if (!onSort) return
    onSort(columnKey, direction)
  }

  const handleColumnClear = (columnKey: string) => {
    if (onSortClear) {
      onSortClear(columnKey)
    }
  }

  const getColumnDirection = (columnKey: string): SortDirection | undefined => {
    if (sortConfig?.sortBy === columnKey) {
      return sortConfig.sortDirection
    }
    return undefined
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className={cn(
        'max-w-none mx-6 mb-24 mt-auto bg-ods-bg rounded-[6px]',
        'max-h-[80vh] animate-in slide-in-from-bottom-4 duration-300',
        'flex flex-col',
        className
      )}
    >
      <ModalHeader className="px-6 py-6 border-b-0">
        <ModalTitle className="text-2xl font-semibold text-ods-text-primary font-['Azeret_Mono'] tracking-[-0.48px]">
          {title}
        </ModalTitle>
      </ModalHeader>

      <ModalContent className="px-6 flex flex-col gap-4 overflow-y-auto min-h-0">
        {sortConfig && sortConfig.columns.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ods-text-secondary uppercase tracking-[-0.24px] font-['Azeret_Mono']">
              {sortConfig.title || 'Sort By'}
            </span>
            <div className="rounded-[6px] border border-ods-border overflow-hidden">
              {sortConfig.columns.map((column, index) => (
                <SortColumnItem
                  key={column.key}
                  column={column}
                  currentDirection={getColumnDirection(column.key)}
                  onSort={(direction) => handleColumnSort(column.key, direction)}
                  onClear={onSortClear ? () => handleColumnClear(column.key) : undefined}
                  isLast={index === sortConfig.columns.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {filterGroups.map((group) => {
          const groupSelection = selectedFilters[group.id] || []

          return (
            <div key={group.id} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ods-text-secondary uppercase tracking-[-0.24px] font-['Azeret_Mono']">
                {group.title}
              </span>
              <div className="rounded-[6px] border border-ods-border overflow-hidden">
                {group.options.map((option, index) => {
                  const isChecked = groupSelection.includes(option.id)

                  return (
                    <div
                      key={option.id}
                      className={cn(index === group.options.length - 1 && 'border-b-0')}
                    >
                      <FilterCheckboxItem
                        option={option}
                        checked={isChecked}
                        onChange={(checked) => handleFilterToggle(group.id, option.id, checked)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </ModalContent>

      <ModalFooter className="px-6 py-6 border-t-0 justify-stretch">
        <Button
          variant="outline"
          className="flex-1 h-11"
          onClick={handleReset}
        >
          {resetButtonText}
        </Button>
        <Button
          variant="primary"
          className="flex-1 h-11"
          onClick={handleApply}
        >
          {applyButtonText}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default MobileFilterSheet
