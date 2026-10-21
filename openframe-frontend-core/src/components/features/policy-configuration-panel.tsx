'use client';

import { ChevronDown, Shield } from 'lucide-react';
import type { FC } from 'react';
import { useState } from 'react';
import type {
  ApprovalLevel,
  PermissionCategory,
  PermissionPolicy,
  PolicyConfigurationPanelProps,
} from '../../types/permissions';
import { cn } from '../../utils/cn';
import { useCollapsible } from '../chat/hooks/use-collapsible';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { ToolIcon } from '../tool-icon';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useLoadingScope } from '../ui/loading-scope';
import { APPROVAL_LEVEL_META, APPROVAL_LEVELS } from './approval-level';

const approvalLevelOptions = APPROVAL_LEVELS.map(value => ({ value, label: APPROVAL_LEVEL_META[value].label }));

const POLICY_LEVEL_WIDTH = 'w-[180px]';
const CATEGORY_LEVEL_WIDTH = 'w-[256px]';

/** How many collapsed category rows the panel draws while loading when the host passes no categories. */
export const POLICY_CONFIGURATION_PANEL_SKELETON_CATEGORIES = 4;

/** A category's header row, read by the row and its skeleton (the same box). */
const CATEGORY_HEADER_CLASS =
  'flex items-center gap-[var(--spacing-system-m)] border-t border-ods-border bg-ods-card py-[var(--spacing-system-s)] pl-[var(--spacing-system-m)] pr-[var(--spacing-system-xsf)] first:border-t-0';
/** The square tile a category's (and a policy's) icon sits in. */
const ICON_TILE_SIZE_CLASS = 'h-8 w-8 shrink-0 rounded-md';
const ICON_TILE_CLASS = cn(ICON_TILE_SIZE_CLASS, 'flex items-center justify-center border border-ods-border bg-ods-bg');
/** The category's name and count column. */
const CATEGORY_TEXT_CLASS = 'flex min-w-0 flex-1 flex-col';
/** The category's empty "Global Permission" column at `md+` outside edit mode. */
const CATEGORY_LEVEL_COLUMN_CLASS = cn(
  'hidden shrink-0 px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)] content-md:block',
  CATEGORY_LEVEL_WIDTH,
);
/** The expand / collapse control's chevron. */
const CHEVRON_CLASS = 'h-6 w-6 text-ods-text-primary transition-transform duration-300';

const getApprovalLevelLabel = (level: ApprovalLevel): string => APPROVAL_LEVEL_META[level]?.label ?? level;

const ApprovalLevelDropdown: FC<{
  value: ApprovalLevel | undefined;
  onChange: (level: ApprovalLevel | undefined) => void;
  /** Adds the "Clear Global Permission" item (category bulk dropdown). */
  allowClear?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
}> = ({ value, onChange, allowClear = false, triggerClassName, contentClassName, disabled }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild disabled={disabled}>
      <Button
        variant="outline"
        disabled={disabled}
        rightIcon={<ChevronDown className="h-6 w-6 text-ods-text-secondary" />}
        className={cn(
          'flex h-auto items-center justify-between gap-[var(--spacing-system-xsf)] rounded-md border border-ods-border bg-ods-card !px-[var(--spacing-system-xsf)] py-[var(--spacing-system-xsf)] transition-colors !text-h6 hover:bg-ods-bg-hover',
          value ? 'text-ods-text-primary' : 'text-ods-text-secondary',
          triggerClassName,
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
        <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)} className="text-h6">
          {option.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const PolicyRow: FC<{
  policy: PermissionPolicy;
  categoryId: string;
  editMode: boolean;
  onPermissionChange: (categoryId: string, policyId: string, level: ApprovalLevel) => void;
}> = ({ policy, categoryId, editMode, onPermissionChange }) => {
  const handleChange = (level: ApprovalLevel | undefined) => {
    if (level) onPermissionChange(categoryId, policy.id, level);
  };

  return (
    <div className="flex items-start gap-[var(--spacing-system-m)] border-b border-ods-border bg-ods-bg px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] last:border-b-0 content-md:items-center">
      {/* Tool Icon */}
      <div className={ICON_TILE_CLASS}>
        <ToolIcon toolType={policy.toolName} size={16} />
      </div>

      {/* Policy Info — on mobile the approval level stacks below the pattern */}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-ods-text-primary text-h4" title={policy.name}>
          {policy.name}
        </p>
        <p className="break-all text-ods-text-secondary text-h6">{policy.commandPattern}</p>
        {editMode ? (
          <div className="mt-[var(--spacing-system-xsf)] content-md:hidden">
            <ApprovalLevelDropdown
              value={policy.approvalLevel}
              onChange={handleChange}
              triggerClassName="w-full"
              contentClassName={POLICY_LEVEL_WIDTH}
            />
          </div>
        ) : policy.approvalLevel ? (
          <span className="text-ods-text-primary text-h4 content-md:hidden">
            {getApprovalLevelLabel(policy.approvalLevel)}
          </span>
        ) : null}
      </div>

      {/* Approval Level column (desktop only) */}
      <div className="hidden shrink-0 content-md:block">
        {editMode ? (
          <ApprovalLevelDropdown
            value={policy.approvalLevel}
            onChange={handleChange}
            triggerClassName={POLICY_LEVEL_WIDTH}
            contentClassName={POLICY_LEVEL_WIDTH}
          />
        ) : (
          <div className={cn('px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)]', POLICY_LEVEL_WIDTH)}>
            {policy.approvalLevel && (
              <span className="text-ods-text-primary text-h4">{getApprovalLevelLabel(policy.approvalLevel)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/** A category before its policies are read: the host's name and icon when it passes them, else nothing yet. */
const LOADING_CATEGORY: PermissionCategory = { id: '', name: '', policies: [] };

/**
 * One category, loaded and loading. While its policies are read (`loading`) the header is the same row, collapsed and
 * inert: the icon static (the host's, else the default shield), the name the host passes drawn for real (a bar when
 * there is none), the configuration count a bar, and the edit-mode dropdowns with their static "Set Global
 * Permission" label, disabled.
 */
const CategorySection: FC<{
  category: PermissionCategory;
  editMode: boolean;
  isExpanded: boolean;
  /** Last bulk level applied to this category (display-only, edit mode). */
  bulkLevel: ApprovalLevel | undefined;
  onToggle: (categoryId: string) => void;
  onBulkLevelChange: (categoryId: string, level: ApprovalLevel | undefined) => void;
  onPolicyPermissionChange: (categoryId: string, policyId: string, level: ApprovalLevel) => void;
  loading?: boolean;
}> = ({
  category,
  editMode,
  isExpanded: isExpandedProp,
  bulkLevel,
  onToggle,
  onBulkLevelChange,
  onPolicyPermissionChange,
  loading = false,
}) => {
  const isExpanded = isExpandedProp && !loading;
  const { innerRef, containerStyle } = useCollapsible({ expanded: isExpanded, durationMs: 300 });
  const handleBulkChange = (level: ApprovalLevel | undefined) => onBulkLevelChange(category.id, level);

  return (
    <>
      {/* Category Header */}
      <div
        data-loading-item
        className={cn(CATEGORY_HEADER_CLASS, !loading && 'cursor-pointer transition-colors hover:bg-ods-bg-hover')}
        onClick={loading ? undefined : () => onToggle(category.id)}
      >
        {/* Category Icon (static: the host's, else the default shield) */}
        <div className={ICON_TILE_CLASS}>
          <div className="text-ods-text-secondary">{category.icon ?? <Shield className="h-4 w-4" />}</div>
        </div>

        {/* Category Info — on mobile the bulk dropdown stacks below the count */}
        <div className={CATEGORY_TEXT_CLASS}>
          {category.name ? (
            <p className="truncate text-ods-text-primary text-h4" title={category.name}>
              {category.name}
            </p>
          ) : (
            <TextLineSkeleton type="h4" className="w-40 max-w-full" />
          )}
          {loading ? (
            <TextLineSkeleton type="h6" className="w-24" />
          ) : (
            <p className="text-ods-text-secondary text-h6">{category.policies.length} Configurations</p>
          )}
          {editMode && (
            <div className="mt-[var(--spacing-system-xsf)] content-md:hidden" onClick={e => e.stopPropagation()}>
              <ApprovalLevelDropdown
                value={bulkLevel}
                onChange={handleBulkChange}
                allowClear
                triggerClassName="w-full"
                contentClassName={CATEGORY_LEVEL_WIDTH}
                disabled={loading}
              />
            </div>
          )}
        </div>

        {/* Global Permission column (desktop only) */}
        {editMode ? (
          <div className="hidden shrink-0 content-md:block" onClick={e => e.stopPropagation()}>
            <ApprovalLevelDropdown
              value={bulkLevel}
              onChange={handleBulkChange}
              allowClear
              triggerClassName={CATEGORY_LEVEL_WIDTH}
              contentClassName={CATEGORY_LEVEL_WIDTH}
              disabled={loading}
            />
          </div>
        ) : (
          <div className={CATEGORY_LEVEL_COLUMN_CLASS} />
        )}

        {/* Expand/Collapse Button */}
        <Button
          type="button"
          variant="transparent"
          disabled={loading}
          onClick={e => {
            e.stopPropagation();
            onToggle(category.id);
          }}
          leftIcon={<ChevronDown className={cn(CHEVRON_CLASS, isExpanded && 'rotate-180')} />}
          className="h-auto w-auto shrink-0 rounded-md"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        />
      </div>

      {/* Policies List (none while they are read) */}
      {!loading && (
        <div
          style={{
            ...containerStyle,
            transition: `${containerStyle.transition}, opacity 300ms ease-in-out, visibility 300ms`,
            // visibility drops collapsed content from the tab order and a11y
            // tree; its discrete transition delays hiding until the fade ends.
            visibility: isExpanded ? 'visible' : 'hidden',
          }}
          className={isExpanded ? 'opacity-100' : 'opacity-0'}
        >
          <div ref={innerRef} className="px-[var(--spacing-system-mf)] pb-[var(--spacing-system-mf)] pt-0">
            <div className="overflow-hidden rounded-md border border-ods-border">
              {category.policies.map(policy => (
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
      )}
    </>
  );
};

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
/** One shared empty map, so a reset that changes nothing changes no identity. */
const NO_BULK_LEVELS: Record<string, ApprovalLevel | undefined> = {};

/** The panel's frame, loaded and loading. */
const PANEL_CLASS = 'overflow-hidden rounded-md border border-ods-border bg-ods-card';

export const PolicyConfigurationPanel: FC<PolicyConfigurationPanelProps> = ({
  categories,
  editMode,
  onPolicyPermissionChange,
  onCategoryPermissionChange,
  loading: loadingProp,
  skeletonCount = POLICY_CONFIGURATION_PANEL_SKELETON_CATEGORIES,
  className,
}) => {
  // ONE switch: in a page's loading state (or while the host reads the policies) every category is its skeleton.
  const loading = useLoadingScope() || !!loadingProp;
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const [bulkLevels, setBulkLevels] = useState<Record<string, ApprovalLevel | undefined>>(NO_BULK_LEVELS);

  // `editMode` is the reset TRIGGER, not an input — the body reads nothing.
  // Adjusted while rendering (React's documented prop-sync pattern) rather than
  // from an effect: the toggle has already scheduled this render, so the stale
  // bulk selections are gone in it instead of being painted once and then
  // cleared by a second pass.
  const [bulkLevelsFor, setBulkLevelsFor] = useState(editMode);
  if (bulkLevelsFor !== editMode) {
    setBulkLevelsFor(editMode);
    setBulkLevels(NO_BULK_LEVELS);
  }

  const handleToggle = (categoryId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const handleBulkLevelChange = (categoryId: string, level: ApprovalLevel | undefined) => {
    setBulkLevels(prev => ({ ...prev, [categoryId]: level }));
    if (level) {
      onCategoryPermissionChange(categoryId, level);
    }
  };

  // While loading: the host's categories as they are, else a typical count of categories not read yet.
  const shown: PermissionCategory[] =
    loading && categories.length === 0 ? Array.from({ length: skeletonCount }, () => LOADING_CATEGORY) : categories;

  return (
    <div className={cn(PANEL_CLASS, className)}>
      {shown.map((category, index) => (
        <CategorySection
          key={category.id || index}
          category={category}
          editMode={editMode}
          isExpanded={expandedIds.has(category.id)}
          bulkLevel={bulkLevels[category.id]}
          onToggle={handleToggle}
          onBulkLevelChange={handleBulkLevelChange}
          onPolicyPermissionChange={onPolicyPermissionChange}
          loading={loading}
        />
      ))}
    </div>
  );
};

PolicyConfigurationPanel.displayName = 'PolicyConfigurationPanel';
