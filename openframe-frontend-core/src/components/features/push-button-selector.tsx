'use client';

import { Check } from 'lucide-react';
import type React from 'react';
import { Badge } from '../ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

export interface SelectableOption {
  id: string; // Selection ID (UUID for platforms, value for others)
  name: string; // Primary identifier (platform enum or item name)
  displayName?: string; // Optional display name (for platforms)
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  icon?: React.ReactNode;
  color?: string;
  disabled?: boolean; // If true, option is shown grayed out and not selectable
  disabledReason?: string; // Tooltip shown on hover when disabled — explains WHY it's unavailable
  section?: string; // Optional section ID to group options
}

export interface SectionDefinition {
  id: string; // Section identifier (matches option.section)
  label: string; // Display label for the section
  icon?: React.ReactNode; // Optional icon for the section header
  description?: string; // Optional description shown under section label
}

interface PushButtonSelectorProps {
  options: SelectableOption[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  multiSelect?: boolean;
  title?: string;
  helpText?: string;
  className?: string;
  selectionSummary?: boolean;
  optional?: boolean;
  isLoading?: boolean;
  error?: string | null;
  skeletonCount?: number;
  sections?: SectionDefinition[]; // Optional sections for grouping options
}

// Skeleton component matching external pattern from announcement-form.tsx
function PushButtonSelectorSkeleton({ count = 3, hasTitle }: { count?: number; hasTitle?: boolean }) {
  return (
    <div className="space-y-3">
      {hasTitle && <div className="h-5 w-20 animate-pulse rounded bg-ods-skeleton" />}
      <div className="space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="animate-pulse rounded-lg border border-ods-border bg-ods-skeleton p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-ods-skeleton" />
                <div>
                  <div className="mb-1 h-4 w-20 rounded bg-ods-skeleton" />
                  <div className="h-3 w-32 rounded bg-ods-skeleton" />
                </div>
              </div>
              <div className="h-6 w-6 rounded border-2 border-ods-border bg-ods-skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Error component using ODS error tokens
function PushButtonSelectorError({ message, title }: { message: string; title?: string }) {
  return (
    <div className="space-y-3">
      {title && <h3 className="text-ods-text-primary text-h5">{title}</h3>}
      <div className="rounded-lg border border-ods-error bg-ods-error-secondary p-4">
        <div className="text-ods-error text-h6">⚠️ {message}</div>
      </div>
    </div>
  );
}

export function PushButtonSelector({
  options,
  selectedIds,
  onSelectionChange,
  multiSelect = true,
  title,
  helpText,
  className = '',
  selectionSummary = false,
  optional = false,
  isLoading = false,
  error = null,
  skeletonCount = 3,
  sections,
}: PushButtonSelectorProps) {
  // LOADING STATE
  if (isLoading) {
    return (
      <div className={className}>
        <PushButtonSelectorSkeleton count={skeletonCount} hasTitle={!!title} />
      </div>
    );
  }

  // ERROR STATE
  if (error) {
    return (
      <div className={className}>
        <PushButtonSelectorError message={error} title={title} />
      </div>
    );
  }

  // VALIDATION: Only filter invalid selectedIds if options are loaded
  const validSelectedIds =
    options.length > 0 ? selectedIds.filter(id => options.some(option => option.id === id)) : selectedIds; // Keep all IDs if options not loaded yet

  // Dev warning for debugging (only when options are loaded)
  if (process.env.NODE_ENV === 'development' && options.length > 0 && validSelectedIds.length !== selectedIds.length) {
    const invalidIds = selectedIds.filter(id => !options.some(opt => opt.id === id));
    console.warn('[PushButtonSelector] Invalid selected IDs filtered:', invalidIds);
  }

  const toggleSelection = (optionId: string) => {
    if (multiSelect) {
      const isSelected = validSelectedIds.includes(optionId);
      if (isSelected) {
        onSelectionChange(validSelectedIds.filter(id => id !== optionId));
      } else {
        onSelectionChange([...validSelectedIds, optionId]);
      }
    } else {
      // Single select mode
      onSelectionChange(validSelectedIds.includes(optionId) ? [] : [optionId]);
    }
  };

  const getSelectedOptions = () => options.filter(option => validSelectedIds.includes(option.id));

  // Helper to render a single option
  const renderOption = (option: SelectableOption) => {
    const isSelected = validSelectedIds.includes(option.id);

    const optionEl = (
      <div
        key={option.id}
        className={`group rounded-lg border p-4 transition-all duration-200 ${
          option.disabled
            ? `${isSelected ? 'cursor-pointer' : 'cursor-not-allowed'} border-ods-border bg-ods-card opacity-40`
            : isSelected
              ? 'cursor-pointer border-ods-accent bg-ods-bg-surface shadow-sm'
              : 'cursor-pointer border-ods-border bg-ods-bg hover:border-ods-border-hover hover:bg-ods-bg-hover'
        } `}
        // Disabled options can't be newly SELECTED, but an already-selected one
        // (e.g. it later became unavailable) must still be removable.
        onClick={() => (!option.disabled || isSelected) && toggleSelection(option.id)}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {option.icon && (
              <div
                className={`flex-shrink-0 transition-transform duration-200 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}
              >
                {option.icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ods-text-primary text-h6">{option.displayName || option.name}</div>
              {option.description && (
                <div className="line-clamp-2 text-ods-text-secondary text-h6" title={option.description}>
                  {option.description}
                </div>
              )}
            </div>
          </div>

          {/* Selection Indicator */}
          <div
            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border-2 transition-all duration-200 ${
              isSelected
                ? 'scale-110 border-ods-accent bg-ods-accent'
                : 'border-ods-border group-hover:border-ods-border-hover'
            } `}
          >
            {isSelected && <Check className="h-4 w-4 font-bold text-ods-text-primary" strokeWidth={3} />}
          </div>
        </div>
      </div>
    );

    // Disabled options explain WHY on hover via the unified Tooltip.
    if (option.disabled && option.disabledReason) {
      return (
        <Tooltip key={option.id}>
          <TooltipTrigger asChild>{optionEl}</TooltipTrigger>
          <TooltipContent className="max-w-xs">{option.disabledReason}</TooltipContent>
        </Tooltip>
      );
    }

    return optionEl;
  };

  // Group options by section if sections are provided
  const renderOptionsContent = () => {
    if (!sections || sections.length === 0) {
      // No sections - render flat list
      return <div className="space-y-3">{options.map(renderOption)}</div>;
    }

    // Group options by section
    const optionsBySection = new Map<string, SelectableOption[]>();
    const ungroupedOptions: SelectableOption[] = [];

    options.forEach(option => {
      if (option.section) {
        const existing = optionsBySection.get(option.section) || [];
        optionsBySection.set(option.section, [...existing, option]);
      } else {
        ungroupedOptions.push(option);
      }
    });

    return (
      <div className="space-y-4">
        {/* Render sections in order */}
        {sections.map(section => {
          const sectionOptions = optionsBySection.get(section.id) || [];
          if (sectionOptions.length === 0) return null;

          return (
            <div key={section.id} className="space-y-2">
              {/* Section Header */}
              <div className="flex items-center gap-2 px-1">
                {section.icon && <div className="text-ods-text-secondary">{section.icon}</div>}
                <div>
                  <div className="font-semibold text-ods-text-primary text-h6">{section.label}</div>
                  {section.description && <div className="text-ods-text-tertiary text-h6">{section.description}</div>}
                </div>
              </div>
              {/* Section Options */}
              <div className="space-y-2">{sectionOptions.map(renderOption)}</div>
            </div>
          );
        })}

        {/* Render ungrouped options at the end */}
        {ungroupedOptions.length > 0 && <div className="space-y-2">{ungroupedOptions.map(renderOption)}</div>}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className={`space-y-4 ${className}`}>
        {title && <h3 className="text-ods-text-primary text-h5">{title}</h3>}

        {renderOptionsContent()}

        {/* Selection Summary */}
        {selectionSummary && validSelectedIds.length > 0 && (
          <div className="rounded-lg border border-ods-success bg-ods-success-secondary p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-ods-success"></div>
              <span className="text-ods-success text-h6">
                {validSelectedIds.length} {multiSelect ? 'items' : 'item'} selected
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {getSelectedOptions().map(option => (
                <Badge key={option.id} className="bg-ods-accent text-ods-text-primary text-h6">
                  {option.displayName || option.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Help Text */}
        {helpText && <div className="text-ods-text-secondary text-h6">{helpText}</div>}

        {/* Empty State Warning */}
        {validSelectedIds.length === 0 && title && !optional && (
          <div className="rounded-lg border border-ods-error bg-ods-error-secondary p-3">
            <div className="text-ods-error text-h6">⚠️ Please select at least one option</div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
