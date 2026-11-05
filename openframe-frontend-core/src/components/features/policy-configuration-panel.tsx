'use client';

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
import { Chevron02DownIcon, ShieldIcon } from '../icons-v2-generated';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { ToolIcon } from '../tool-icon';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { loadingItemProps, useLoadingScope } from '../ui/loading-scope';
import { APPROVAL_LEVEL_META, APPROVAL_LEVELS, ApprovalLevelView } from './approval-level';

const CATEGORY_LEVEL_WIDTH = 'w-[296px]';

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
const CHEVRON_CLASS = '!h-6 !w-6 text-ods-text-primary transition-transform duration-300';

/** A level as the dropdown writes it: its icon in its colour (the trigger's chevron size, 24px), then its name. */
const LevelOption: FC<{ level: ApprovalLevel }> = ({ level }) => {
  const { label, Icon, toneClassName } = APPROVAL_LEVEL_META[level];
  return (
    <span className="inline-flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
      <Icon size={24} className={cn('shrink-0', toneClassName)} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
};

/** A dropdown item at its trigger's scale: the trigger's type and icon size, a field's height (48px). The menu is
 *  portalled to the window, so it steps with the window (`md:`), not the content. */
const LEVEL_MENU_ITEM_CLASS = 'p-[var(--spacing-system-sf)] text-h4 [&_svg]:size-4 md:[&_svg]:size-6';

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
        rightIcon={<Chevron02DownIcon className="!h-6 !w-6 text-ods-text-secondary" />}
        className={cn(
          'flex h-auto items-center justify-between gap-[var(--spacing-system-xsf)] rounded-md border border-ods-border bg-ods-card !p-[var(--spacing-system-sf)] transition-colors !text-h4 hover:bg-ods-bg-hover',
          value ? 'text-ods-text-primary' : 'text-ods-text-secondary',
          triggerClassName,
        )}
      >
        {value ? <LevelOption level={value} /> : 'Set Global Permission'}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className={contentClassName}>
      {allowClear && (
        <DropdownMenuItem onClick={() => onChange(undefined)} className={LEVEL_MENU_ITEM_CLASS}>
          Clear Global Permission
        </DropdownMenuItem>
      )}
      {APPROVAL_LEVELS.map(level => (
        <DropdownMenuItem key={level} onClick={() => onChange(level)} className={LEVEL_MENU_ITEM_CLASS}>
          <LevelOption level={level} />
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
  const nameId = `policy-${categoryId}-${policy.id}`;
  // The level as every guardrail surface draws it: its icon in its colour, then its name (Figma 1608-49525), or, while
  // editing, its name in its colour beside the four levels' icons to pick from (Figma 4365-22663).
  const level = policy.approvalLevel ? (
    <ApprovalLevelView
      value={policy.approvalLevel}
      editable={editMode}
      onChange={next => onPermissionChange(categoryId, policy.id, next)}
      aria-labelledby={nameId}
    />
  ) : null;

  return (
    <div className="flex items-start gap-[var(--spacing-system-m)] border-b border-ods-border bg-ods-bg px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] last:border-b-0 content-md:items-center">
      {/* Tool Icon: grey, as the category's (Figma 1608-49526). Editing on a phone it moves beside the name, and the
          strip gets the row's width (Figma 4365-22455). */}
      <div className={cn(ICON_TILE_CLASS, 'text-ods-text-secondary', editMode && 'hidden content-md:flex')}>
        <ToolIcon toolType={policy.toolName} size={16} />
      </div>

      {/* Policy Info — on mobile the approval level stacks below the pattern */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-sf)]">
          <div className="flex min-w-0 flex-1 flex-col">
            <p id={nameId} className="truncate text-ods-text-primary text-h4" title={policy.name}>
              {policy.name}
            </p>
            <p className="truncate text-ods-text-secondary text-h6" title={policy.commandPattern}>
              {policy.commandPattern}
            </p>
          </div>
          {editMode && (
            <span className="flex shrink-0 text-ods-text-secondary content-md:hidden">
              <ToolIcon toolType={policy.toolName} size={16} />
            </span>
          )}
        </div>
        {level && (
          <div className={cn('flex content-md:hidden', editMode && 'mt-[var(--spacing-system-sf)]')}>{level}</div>
        )}
      </div>

      {/* Approval Level column (desktop only). A flex box, not a block: a block's line box around the inline level
          stood taller than the level and set it above the row's centre. */}
      {level && <div className="hidden shrink-0 items-center content-md:flex">{level}</div>}
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
  /** List markers (`data-loading-item`), set by the panel on each category header. */
  [key: `data-${string}`]: unknown;
}> = ({
  category,
  editMode,
  isExpanded: isExpandedProp,
  bulkLevel,
  onToggle,
  onBulkLevelChange,
  onPolicyPermissionChange,
  loading: loadingGiven = false,
  ...props
}) => {
  // ONE switch: a page's loading scope, or the panel's read.
  const loading = useLoadingScope() || loadingGiven;
  const isExpanded = isExpandedProp && !loading;
  const { innerRef, containerStyle } = useCollapsible({ expanded: isExpanded, durationMs: 300 });
  const handleBulkChange = (level: ApprovalLevel | undefined) => onBulkLevelChange(category.id, level);

  return (
    <>
      {/* Category Header */}
      <div
        {...loadingItemProps(props)}
        className={cn(
          CATEGORY_HEADER_CLASS,
          'peer',
          !loading && 'cursor-pointer transition-colors hover:bg-ods-bg-hover',
        )}
        onClick={loading ? undefined : () => onToggle(category.id)}
      >
        {/* Category Icon (static: the host's, else the default shield) */}
        <div className={ICON_TILE_CLASS}>
          <div className="text-ods-text-secondary">{category.icon ?? <ShieldIcon size={16} />}</div>
        </div>

        {/* Category Info. A phone has no bulk dropdown (Figma 4365-22446): its rules are set one by one. */}
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
            <p className="text-ods-text-secondary text-h6">
              {category.policies.length} {category.policies.length === 1 ? 'Configuration' : 'Configurations'}
            </p>
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
          leftIcon={<Chevron02DownIcon className={cn(CHEVRON_CLASS, isExpanded && 'rotate-180')} />}
          // 40px on a phone (Figma 4365-22452), 48 from content-md.
          className="h-auto w-auto shrink-0 rounded-md !p-[var(--spacing-system-xsf)] content-md:!p-[var(--spacing-system-sf)]"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        />
      </div>

      {/* Policies List: collapsed while the policies are read (`isExpanded` is false), so it takes no height. */}
      <div
        style={{
          ...containerStyle,
          // background-color: the header's hover, in step with the header (`transition-colors`, 150ms).
          transition: `${containerStyle.transition}, opacity 300ms ease-in-out, visibility 300ms, background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)`,
          // visibility drops collapsed content from the tab order and a11y
          // tree; its discrete transition delays hiding until the fade ends.
          visibility: isExpanded ? 'visible' : 'hidden',
        }}
        // Hovering the header lights the open category whole: the frame around its rules with the header, not the
        // header alone over an unlit frame.
        className={cn(isExpanded ? 'opacity-100' : 'opacity-0', !loading && 'peer-hover:bg-ods-bg-hover')}
      >
        <div ref={innerRef} className="px-[var(--spacing-system-mf)] pb-[var(--spacing-system-mf)] pt-0">
          <div className="overflow-hidden rounded-md border border-ods-border">
            {/* No rows while the policies are read: nothing read is drawn, even collapsed. */}
            {(loading ? [] : category.policies).map(policy => (
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
  );
};

/**
 * Grouped list of permission categories with per-policy approval dropdowns.
 * Presentation state — which categories are expanded and the last bulk level
 * picked per category — lives inside the panel, so callers pass pure data and
 * background data refreshes never collapse the user's view. Bulk selections
 * reset when `editMode` changes.
 *
 * Responsive (content width): below `content-md` a rule's level stacks under its
 * pattern, and a category has no bulk dropdown (Figma 4365-22405); from
 * `content-md` both are right-hand columns.
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
          data-loading-item
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
