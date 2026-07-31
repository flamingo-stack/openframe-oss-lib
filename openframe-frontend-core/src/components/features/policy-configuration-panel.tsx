"use client"

import * as React from 'react'
import { useEffect, useState } from 'react'
import { ChevronDown, Shield } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useCollapsible } from '../chat/hooks/use-collapsible'
import { ToolIcon } from '../tool-icon'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  ApprovalLevel,
  PermissionCategory,
  PermissionPolicy,
  PolicyConfigurationPanelProps
} from '../../types/permissions'

const approvalLevelLabels: Record<ApprovalLevel, string> = {
  ALLOW: 'Allow',
  ASK_USER: 'Ask User',
  ASK_TECHNICIAN: 'Ask Technician',
  DENY: 'Restrict',
}

const approvalLevelOptions = (Object.keys(approvalLevelLabels) as ApprovalLevel[]).map(
  value => ({ value, label: approvalLevelLabels[value] })
)

const POLICY_LEVEL_WIDTH = 'w-[180px]'
const CATEGORY_LEVEL_WIDTH = 'w-[256px]'

const getApprovalLevelLabel = (level: ApprovalLevel): string => approvalLevelLabels[level] ?? level

const ApprovalLevelDropdown: React.FC<{
  value: ApprovalLevel | undefined;
  onChange: (level: ApprovalLevel | undefined) => void;
  /** Adds the "Clear Global Permission" item (category bulk dropdown). */
  allowClear?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
}> = ({ value, onChange, allowClear = false, triggerClassName, contentClassName }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        rightIcon={<ChevronDown className="h-6 w-6 text-ods-text-secondary" />}
        className={cn(
          "!text-h6 bg-ods-card border border-ods-border rounded-md flex gap-[var(--spacing-system-xsf)] items-center justify-between !px-[var(--spacing-system-xsf)] py-[var(--spacing-system-xsf)] hover:bg-ods-bg-hover transition-colors h-auto",
          value ? "text-ods-text-primary" : "text-ods-text-secondary",
          triggerClassName
        )}
      >
        {value ? getApprovalLevelLabel(value) : 'Set Global Permission'}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className={contentClassName}>
      {allowClear && (
        <DropdownMenuItem onClick={() => onChange(undefined)} className="text-h6">
          Clear Global Permission
        </DropdownMenuItem>
      )}
      {approvalLevelOptions.map(option => (
        <DropdownMenuItem
          key={option.value}
          onClick={() => onChange(option.value)}
          className="text-h6"
        >
          {option.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
)

const PolicyRow: React.FC<{
  policy: PermissionPolicy;
  categoryId: string;
  editMode: boolean;
  onPermissionChange: (categoryId: string, policyId: string, level: ApprovalLevel) => void;
}> = ({ policy, categoryId, editMode, onPermissionChange }) => {
  const handleChange = (level: ApprovalLevel | undefined) => {
    if (level) onPermissionChange(categoryId, policy.id, level)
  }

  return (
    <div className="bg-ods-bg border-b last:border-b-0 border-ods-border flex gap-[var(--spacing-system-m)] items-start md:items-center px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)]">
      {/* Tool Icon */}
      <div className="bg-ods-bg border border-ods-border rounded-md flex items-center justify-center w-8 h-8 shrink-0">
        <ToolIcon toolType={policy.toolName} size={16} />
      </div>

      {/* Policy Info — on mobile the approval level stacks below the pattern */}
      <div className="flex-1 flex flex-col min-w-0">
        <p className="text-h4 text-ods-text-primary truncate" title={policy.name}>
          {policy.name}
        </p>
        <p className="text-h6 text-ods-text-secondary break-all">
          {policy.commandPattern}
        </p>
        {editMode ? (
          <div className="md:hidden mt-[var(--spacing-system-xsf)]">
            <ApprovalLevelDropdown
              value={policy.approvalLevel}
              onChange={handleChange}
              triggerClassName="w-full"
              contentClassName={POLICY_LEVEL_WIDTH}
            />
          </div>
        ) : policy.approvalLevel ? (
          <span className="md:hidden text-h4 text-ods-text-primary">
            {getApprovalLevelLabel(policy.approvalLevel)}
          </span>
        ) : null}
      </div>

      {/* Approval Level column (desktop only) */}
      <div className="hidden md:block shrink-0">
        {editMode ? (
          <ApprovalLevelDropdown
            value={policy.approvalLevel}
            onChange={handleChange}
            triggerClassName={POLICY_LEVEL_WIDTH}
            contentClassName={POLICY_LEVEL_WIDTH}
          />
        ) : (
          <div className={cn("px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)]", POLICY_LEVEL_WIDTH)}>
            {policy.approvalLevel && (
              <span className="text-h4 text-ods-text-primary">
                {getApprovalLevelLabel(policy.approvalLevel)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const CategorySection: React.FC<{
  category: PermissionCategory;
  editMode: boolean;
  isExpanded: boolean;
  /** Last bulk level applied to this category (display-only, edit mode). */
  bulkLevel: ApprovalLevel | undefined;
  onToggle: (categoryId: string) => void;
  onBulkLevelChange: (categoryId: string, level: ApprovalLevel | undefined) => void;
  onPolicyPermissionChange: (categoryId: string, policyId: string, level: ApprovalLevel) => void;
}> = ({
  category,
  editMode,
  isExpanded,
  bulkLevel,
  onToggle,
  onBulkLevelChange,
  onPolicyPermissionChange
}) => {
  const { innerRef, containerStyle } = useCollapsible({ expanded: isExpanded, durationMs: 300 })
  const handleBulkChange = (level: ApprovalLevel | undefined) => onBulkLevelChange(category.id, level)

  return (
    <>
      {/* Category Header */}
      <div
        className="bg-ods-card border-t first:border-t-0 border-ods-border flex gap-[var(--spacing-system-m)] items-center pl-[var(--spacing-system-m)] pr-[var(--spacing-system-xsf)] py-[var(--spacing-system-s)] cursor-pointer hover:bg-ods-bg-hover transition-colors"
        onClick={() => onToggle(category.id)}
      >
        {/* Category Icon */}
        <div className="bg-ods-bg border border-ods-border rounded-md flex items-center justify-center w-8 h-8 shrink-0">
          <div className="text-ods-text-secondary">
            {category.icon ?? <Shield className="w-4 h-4" />}
          </div>
        </div>

        {/* Category Info — on mobile the bulk dropdown stacks below the count */}
        <div className="flex-1 flex flex-col min-w-0">
          <p className="text-h4 text-ods-text-primary truncate" title={category.name}>
            {category.name}
          </p>
          <p className="text-h6 text-ods-text-secondary">
            {category.policies.length} Configurations
          </p>
          {editMode && (
            <div className="md:hidden mt-[var(--spacing-system-xsf)]" onClick={(e) => e.stopPropagation()}>
              <ApprovalLevelDropdown
                value={bulkLevel}
                onChange={handleBulkChange}
                allowClear
                triggerClassName="w-full"
                contentClassName={CATEGORY_LEVEL_WIDTH}
              />
            </div>
          )}
        </div>

        {/* Global Permission column (desktop only) */}
        {editMode ? (
          <div className="hidden md:block shrink-0" onClick={(e) => e.stopPropagation()}>
            <ApprovalLevelDropdown
              value={bulkLevel}
              onChange={handleBulkChange}
              allowClear
              triggerClassName={CATEGORY_LEVEL_WIDTH}
              contentClassName={CATEGORY_LEVEL_WIDTH}
            />
          </div>
        ) : (
          <div className={cn("hidden md:block px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)] shrink-0", CATEGORY_LEVEL_WIDTH)} />
        )}

        {/* Expand/Collapse Button */}
        <Button
          type="button"
          variant="transparent"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(category.id);
          }}
          leftIcon={<ChevronDown
            className={cn(
              "h-6 w-6 text-ods-text-primary transition-transform duration-300",
              isExpanded && "rotate-180"
            )}
          />}
          className="rounded-md h-auto w-auto shrink-0"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        />
      </div>

      {/* Policies List */}
      <div
        style={{
          ...containerStyle,
          transition: `${containerStyle.transition}, opacity 300ms ease-in-out, visibility 300ms`,
          // visibility drops collapsed content from the tab order and a11y
          // tree; its discrete transition delays hiding until the fade ends.
          visibility: isExpanded ? 'visible' : 'hidden',
        }}
        className={isExpanded ? "opacity-100" : "opacity-0"}
      >
        <div ref={innerRef} className="px-[var(--spacing-system-mf)] pb-[var(--spacing-system-mf)] pt-0">
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

/**
 * Grouped list of permission categories with per-policy approval dropdowns.
 * Presentation state — which categories are expanded and the last bulk level
 * picked per category — lives inside the panel, so callers pass pure data and
 * background data refreshes never collapse the user's view. Bulk selections
 * reset when `editMode` changes.
 *
 * Responsive: below `md` the approval level / dropdowns stack inside the text
 * column (per the ODS mobile design); at `md+` they render as fixed-width
 * right-hand columns.
 */
export const PolicyConfigurationPanel: React.FC<PolicyConfigurationPanelProps> = ({
  categories,
  editMode,
  onPolicyPermissionChange,
  onCategoryPermissionChange,
  className
}) => {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set())
  const [bulkLevels, setBulkLevels] = useState<Record<string, ApprovalLevel | undefined>>({})

  // biome-ignore lint/correctness/useExhaustiveDependencies: editMode is the reset trigger, not read in the body
  useEffect(() => {
    setBulkLevels({})
  }, [editMode])

  const handleToggle = (categoryId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  const handleBulkLevelChange = (categoryId: string, level: ApprovalLevel | undefined) => {
    setBulkLevels(prev => ({ ...prev, [categoryId]: level }))
    if (level) {
      onCategoryPermissionChange(categoryId, level)
    }
  }

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
          isExpanded={expandedIds.has(category.id)}
          bulkLevel={bulkLevels[category.id]}
          onToggle={handleToggle}
          onBulkLevelChange={handleBulkLevelChange}
          onPolicyPermissionChange={onPolicyPermissionChange}
        />
      ))}
    </div>
  )
}

PolicyConfigurationPanel.displayName = 'PolicyConfigurationPanel'
