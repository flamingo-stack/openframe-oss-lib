"use client"

import * as React from 'react'
import { useRef, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import { ToolIcon } from '../tool-icon'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../dropdown-menu'
import {
  ApprovalLevel,
  PermissionCategory,
  PermissionPolicy,
  PolicyConfigurationPanelProps
} from '../../types/permissions'

const approvalLevelOptions: { value: ApprovalLevel; label: string }[] = [
  { value: 'ALLOW', label: 'Allow' },
  { value: 'ASK_USER', label: 'Ask User' },
  { value: 'ASK_TECHNICIAN', label: 'Ask Technician' },
  { value: 'DENY', label: 'Restrict' },
]

const getApprovalLevelLabel = (level: ApprovalLevel | undefined, editMode: boolean = false): string => {
  if (!level) {
    return editMode ? 'Set Global Permission' : ''
  }
  const option = approvalLevelOptions.find(opt => opt.value === level)
  return option?.label || level
}

const PolicyRow: React.FC<{
  policy: PermissionPolicy;
  categoryId: string;
  editMode: boolean;
  onPermissionChange: (categoryId: string, policyId: string, level: ApprovalLevel) => void;
}> = ({ policy, categoryId, editMode, onPermissionChange }) => {
  return (
    <div className="bg-ods-bg border-b border-ods-border flex gap-4 items-center px-4 py-3">
      {/* Tool Icon */}
      <div className="bg-ods-bg border border-ods-border rounded-md flex items-center justify-center w-8 h-8">
        <ToolIcon toolType={policy.toolName} size={16} />
      </div>

      {/* Policy Info */}
      <div className="flex-1 flex flex-col min-w-0">
        <p className="text-[16px] font-medium text-ods-text-primary truncate">
          {policy.name}
        </p>
        <p className="text-[12px] text-ods-text-secondary break-all font-mono">
          {policy.commandPattern}
        </p>
      </div>

      {/* Approval Level Dropdown */}
      {editMode ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline"
              rightIcon={<ChevronDown className="h-6 w-6 text-ods-text-secondary" />}
              className="sm:!text-sm bg-ods-card border border-ods-border rounded-md flex gap-2 items-center justify-between !px-2 py-2 w-[180px] hover:bg-ods-bg-hover transition-colors text-ods-text-primary h-auto"
            >
              {getApprovalLevelLabel(policy.approvalLevel, editMode)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            {approvalLevelOptions.map(option => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onPermissionChange(categoryId, policy.id, option.value)}
                className="text-[16px]"
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : policy.approvalLevel ? (
        <div className="px-3 py-2 w-[180px]">
          <span className="text-[16px] font-medium text-ods-text-primary">
            {getApprovalLevelLabel(policy.approvalLevel, editMode)}
          </span>
        </div>
      ) : (
        <div className="px-3 py-2 w-[180px]" />
      )}
    </div>
  )
}

const useAnimatedHeight = (isExpanded: boolean) => {
  const [height, setHeight] = useState<number | 'auto'>(0);
  const contentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (contentRef.current) {
      const contentHeight = contentRef.current.scrollHeight;
      setHeight(isExpanded ? contentHeight : 0);
    }
  }, [isExpanded]);

  return { contentRef, height };
};

const CategorySection: React.FC<{
  category: PermissionCategory;
  editMode: boolean;
  onCategoryToggle: (categoryId: string) => void;
  onGlobalPermissionChange: (categoryId: string, level: ApprovalLevel | undefined) => void;
  onPolicyPermissionChange: (categoryId: string, policyId: string, level: ApprovalLevel) => void;
}> = ({ 
  category, 
  editMode, 
  onCategoryToggle, 
  onGlobalPermissionChange, 
  onPolicyPermissionChange 
}) => {
  const { contentRef, height } = useAnimatedHeight(category.isExpanded);
  
  return (
    <>
      {/* Category Header */}
      <div 
        className="bg-ods-card border-t border-ods-border flex gap-4 items-center pl-4 pr-2 py-3 cursor-pointer hover:bg-ods-bg-hover transition-colors"
        onClick={() => onCategoryToggle(category.id)}
      >
        {/* Category Icon */}
        <div className="bg-ods-bg border border-ods-border rounded-md flex items-center justify-center w-8 h-8">
          <div className="text-ods-text-secondary">
            {category.icon}
          </div>
        </div>

        {/* Category Info */}
        <div className="flex-1 flex flex-col">
          <p className="sm:!test-sm font-medium text-ods-text-primary">
            {category.name}
          </p>
          <p className="text-[14px] text-ods-text-secondary">
            {category.configurationsCount} Configurations
          </p>
        </div>

        {/* Global Permission Dropdown */}
        {editMode ? (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  rightIcon={<ChevronDown className="h-6 w-6 text-ods-text-secondary" />}
                  className="sm:!text-sm bg-ods-card border border-ods-border rounded-md flex gap-2 items-center justify-between !px-2 py-2 w-[256px] hover:bg-ods-bg-hover transition-colors h-auto"
                >
                  <span className={cn(
                    "sm:!text-sm font-medium",
                    category.globalPermission 
                      ? "text-ods-text-primary" 
                      : "text-ods-text-secondary"
                  )}>
                    {getApprovalLevelLabel(category.globalPermission, editMode)}
                  </span>
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[256px]">
              <DropdownMenuItem
                onClick={() => onGlobalPermissionChange(category.id, undefined)}
                className="sm:!text-sm"
              >
                Clear Global Permission
              </DropdownMenuItem>
              {approvalLevelOptions.map(option => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onGlobalPermissionChange(category.id, option.value)}
                  className="sm:!text-sm"
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        ) : category.globalPermission ? (
          <div 
            className="px-3 py-2 w-[256px]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="sm:!text-sm font-medium text-ods-text-primary">
              {getApprovalLevelLabel(category.globalPermission, editMode)}
            </span>
          </div>
        ) : (
          <div 
            className="px-3 py-2 w-[256px]" 
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Expand/Collapse Button */}
        <Button
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onCategoryToggle(category.id);
          }}
          centerIcon={<ChevronDown 
            className={cn(
              "h-6 w-6 text-ods-text-primary transition-transform duration-300",
              category.isExpanded && "rotate-180"
            )} 
          />}
          className="rounded-md h-auto w-auto"
          aria-label={category.isExpanded ? "Collapse" : "Expand"}
        />
      </div>

      {/* Policies List */}
      <div 
        ref={contentRef}
        style={{ 
          height: height === 'auto' ? 'auto' : `${height}px`,
          transition: 'height 300ms ease-in-out, opacity 300ms ease-in-out'
        }}
        className={cn(
          "overflow-hidden",
          category.isExpanded ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="px-4 pb-4 pt-0">
          <div className="border border-ods-border rounded-md overflow-hidden">
            {category.policies.map((policy) => (
              <PolicyRow
                key={policy.id}
                policy={policy}
                categoryId={category.id}
                editMode={editMode}
                onPermissionChange={onPolicyPermissionChange}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export const PolicyConfigurationPanel: React.FC<PolicyConfigurationPanelProps> = ({
  categories,
  editMode,
  onCategoryToggle,
  onGlobalPermissionChange,
  onPolicyPermissionChange,
  className
}) => {
  return (
    <div className={cn(
      "bg-ods-card border border-ods-border rounded-md overflow-hidden",
      className
    )}>
      {categories.map((category) => (
        <CategorySection
          key={category.id}
          category={category}
          editMode={editMode}
          onCategoryToggle={onCategoryToggle}
          onGlobalPermissionChange={onGlobalPermissionChange}
          onPolicyPermissionChange={onPolicyPermissionChange}
        />
      ))}
    </div>
  )
}

PolicyConfigurationPanel.displayName = 'PolicyConfigurationPanel'