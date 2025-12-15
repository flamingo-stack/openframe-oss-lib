"use client";

import { Button, Badge } from "../ui";
import { Check } from 'lucide-react';
import React from 'react';

export interface SelectableOption {
  id: string;
  name: string;
  description?: string;
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
  optional = false
}: PushButtonSelectorProps) {

  const toggleSelection = (optionId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(optionId);
      if (isSelected) {
        onSelectionChange(selectedIds.filter(id => id !== optionId));
      } else {
        onSelectionChange([...selectedIds, optionId]);
      }
    } else {
      // Single select mode
      onSelectionChange(selectedIds.includes(optionId) ? [] : [optionId]);
    }
  };

  const getSelectedOptions = () => options.filter(option => selectedIds.includes(option.id));

  return (
    <div className={`space-y-4 ${className}`}>
      {title && (
        <h3 className="font-['Azeret_Mono'] text-[16px] font-semibold text-ods-text-primary uppercase">
          {title}
        </h3>
      )}

      <div className="space-y-3">
        {options.map(option => {
          const isSelected = selectedIds.includes(option.id);

          return (
            <div
              key={option.id}
              className={`
                p-4 rounded-lg border transition-all duration-200 cursor-pointer group
                ${isSelected
                  ? 'bg-[#2A2A2A] border-[#FFC008] shadow-sm'
                  : 'bg-[#1A1A1A] border-ods-border hover:border-[#4A4A4A] hover:bg-[#222222]'
                }
              `}
              onClick={() => toggleSelection(option.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {option.icon && (
                    <div className={`transition-transform duration-200 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}>
                      {option.icon}
                    </div>
                  )}
                  <div>
                    <div className="font-['DM_Sans'] text-[16px] font-semibold text-ods-text-primary">
                      {option.name}
                    </div>
                    {option.description && (
                      <div className="font-['DM_Sans'] text-[12px] text-ods-text-secondary">
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selection Indicator */}
                <div className={`
                  w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-200
                  ${isSelected
                    ? 'bg-[#FFC008] border-[#FFC008] scale-110'
                    : 'border-[#4A4A4A] group-hover:border-[#6A6A6A]'
                  }
                `}>
                  {isSelected && (
                    <Check className="w-4 h-4 text-[#1A1A1A] font-bold" strokeWidth={3} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selection Summary */}
      {selectionSummary && selectedIds.length > 0 && (
        <div className="p-4 bg-[#1A2B1A] border border-[#22C55E]/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-[#22C55E] rounded-full"></div>
            <span className="font-['DM_Sans'] text-[14px] text-[#22C55E] font-medium">
              {selectedIds.length} {multiSelect ? 'items' : 'item'} selected
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {getSelectedOptions().map(option => (
              <Badge
                key={option.id}
                className="bg-ods-accent text-[#1A1A1A] font-['DM_Sans'] text-[12px] font-medium"
              >
                {option.name}
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
      {selectedIds.length === 0 && title && !optional && (
        <div className="p-3 bg-[#2A1F1F] border border-[#6B2C2C]/30 rounded-lg">
          <div className="font-['DM_Sans'] text-[12px] text-[#FF6B6B]">
            ⚠️ Please select at least one option
          </div>
        </div>
      )}
    </div>
  );
}