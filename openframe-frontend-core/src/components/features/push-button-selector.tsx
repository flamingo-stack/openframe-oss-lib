"use client";

import { Button, Badge } from "../ui";
import { Check } from 'lucide-react';
import React from 'react';

export interface SelectableOption {
  id: string;              // Selection ID (UUID for platforms, value for others)
  name: string;            // Primary identifier (platform enum or item name)
  displayName?: string;    // Optional display name (for platforms)
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  icon?: React.ReactNode;
  color?: string;
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
}

// Skeleton component matching external pattern from announcement-form.tsx
function PushButtonSelectorSkeleton({ count = 3, hasTitle }: { count?: number; hasTitle?: boolean }) {
  return (
    <div className="space-y-3">
      {hasTitle && (
        <div className="h-5 w-20 bg-ods-bg-secondary rounded animate-pulse" />
      )}
      <div className="space-y-3">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="p-4 rounded-lg border border-ods-border bg-ods-bg-secondary animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-ods-bg-primary rounded" />
                <div>
                  <div className="h-4 w-20 bg-ods-bg-primary rounded mb-1" />
                  <div className="h-3 w-32 bg-ods-bg-primary rounded" />
                </div>
              </div>
              <div className="w-6 h-6 bg-ods-bg-primary rounded border-2 border-ods-border" />
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
      {title && (
        <h3 className="font-['Azeret_Mono'] text-[16px] font-semibold text-ods-text-primary uppercase">
          {title}
        </h3>
      )}
      <div className="p-4 bg-ods-attention-red-error-secondary border border-ods-attention-red-error/30 rounded-lg">
        <div className="font-['DM_Sans'] text-[14px] text-ods-attention-red-error">
          ⚠️ {message}
        </div>
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
  skeletonCount = 3
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
  const validSelectedIds = options.length > 0
    ? selectedIds.filter(id => options.some(option => option.id === id))
    : selectedIds; // Keep all IDs if options not loaded yet

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

  return (
    <div className={`space-y-4 ${className}`}>
      {title && (
        <h3 className="font-['Azeret_Mono'] text-[16px] font-semibold text-ods-text-primary uppercase">
          {title}
        </h3>
      )}

      <div className="space-y-3">
        {options.map(option => {
          const isSelected = validSelectedIds.includes(option.id);

          return (
            <div
              key={option.id}
              className={`
                p-4 rounded-lg border transition-all duration-200 cursor-pointer group
                ${isSelected
                  ? 'bg-ods-bg-secondary border-ods-accent shadow-sm'
                  : 'bg-ods-bg-primary border-ods-border hover:border-ods-border-hover hover:bg-ods-bg-hover'
                }
              `}
              onClick={() => toggleSelection(option.id)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {option.icon && (
                    <div className={`flex-shrink-0 transition-transform duration-200 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}>
                      {option.icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-['DM_Sans'] text-[16px] font-semibold text-ods-text-primary">
                      {option.displayName || option.name}
                    </div>
                    {option.description && (
                      <div className="font-['DM_Sans'] text-[12px] text-ods-text-secondary line-clamp-2">
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selection Indicator */}
                <div className={`
                  flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-200
                  ${isSelected
                    ? 'bg-ods-accent border-ods-accent scale-110'
                    : 'border-ods-border group-hover:border-ods-border-hover'
                  }
                `}>
                  {isSelected && (
                    <Check className="w-4 h-4 text-ods-text-primary font-bold" strokeWidth={3} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selection Summary */}
      {selectionSummary && validSelectedIds.length > 0 && (
        <div className="p-4 bg-ods-attention-green-success-secondary border border-ods-attention-green-success/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-ods-attention-green-success rounded-full"></div>
            <span className="font-['DM_Sans'] text-[14px] text-ods-attention-green-success font-medium">
              {validSelectedIds.length} {multiSelect ? 'items' : 'item'} selected
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {getSelectedOptions().map(option => (
              <Badge
                key={option.id}
                className="bg-ods-accent text-ods-text-primary font-['DM_Sans'] text-[12px] font-medium"
              >
                {option.displayName || option.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      {helpText && (
        <div className="text-[12px] text-ods-text-secondary font-['DM_Sans']">
          {helpText}
        </div>
      )}

      {/* Empty State Warning */}
      {validSelectedIds.length === 0 && title && !optional && (
        <div className="p-3 bg-ods-attention-red-error-secondary border border-ods-attention-red-error/30 rounded-lg">
          <div className="font-['DM_Sans'] text-[12px] text-ods-attention-red-error">
            ⚠️ Please select at least one option
          </div>
        </div>
      )}
    </div>
  );
}