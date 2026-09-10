'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Chevron02DownIcon } from '../icons-v2-generated/arrows/chevron-02-down-icon';
import { UserIcon } from '../icons-v2-generated/users/user-icon';
import { AssigneeDropdown, type TicketAssigneeOption } from './assignee-dropdown';
import { SimpleMarkdownRenderer } from './markdown/simple-markdown-renderer';
import { SquareAvatar } from './square-avatar';
import { Tag } from './tag';
import { type TicketAttachment, TicketAttachmentsList } from './ticket-attachments-list';
import { TicketDetailSection } from './ticket-detail-section';
import type { TicketNote } from './ticket-note-card';
import { TicketNotesSection } from './ticket-notes-section';
import { TicketStatusTag, type TicketStatusTagOption } from './ticket-status-tag';

export type { TicketAssigneeOption };

export interface TicketInfoSectionProps {
  /** Organization name and image */
  organization?: {
    name: string;
    imageSrc?: string;
  };
  /** User name */
  user?: string;
  /** Device info */
  device?: {
    name: string;
    icon?: ReactNode;
    onClick?: () => void;
  };
  /** Status tag */
  status?: string;
  /** Display label for the status tag (e.g. a custom status name). */
  statusLabel?: string;
  /** Hex color for the status tag (e.g. a custom status color). */
  statusColor?: string;
  /** When provided, the status tag becomes an inline changer with these options. */
  statusOptions?: TicketStatusTagOption[];
  /** Called with the chosen status id from the inline status dropdown. */
  onStatusSelect?: (id: string) => void;
  /** Disables the inline status dropdown while a change is in flight. */
  isStatusPending?: boolean;
  /** Locks the status: renders the plain tag instead of the dropdown (e.g. a pending approval blocks the transition). */
  isStatusDisabled?: boolean;
  /** Reason shown in a tooltip over the status tag when `isStatusDisabled`. */
  statusDisabledReason?: string;
  /** Expand button click handler */
  onExpand?: () => void;
  /** Whether the section is expanded */
  expanded?: boolean;
  /** Additional className */
  className?: string;

  // --- Expanded view props ---

  /** Assigned person info with inline dropdown */
  assigned?: {
    currentAssignee?: {
      id: string;
      name: string;
      avatarSrc?: string;
      /** Deleted account (DELETED / SELF_DELETED) — renders the red user-x placeholder + red name. */
      deleted?: boolean;
    };
    options: TicketAssigneeOption[];
    isLoading?: boolean;
    isPending?: boolean;
    onAssign: (userId: string | null) => void;
  };
  /** Created date string */
  createdAt?: string;
  /** Ticket description — markdown/HTML content */
  description?: string;
  /** File attachments (view-only with download) */
  attachments?: TicketAttachment[];
  /** Tag labels */
  tags?: string[];
  /** Notes */
  notes?: TicketNote[];
  onAddNote?: (text: string) => void;
  onEditNote?: (id: string, text: string) => void;
  onDeleteNote?: (id: string) => void;
  /** Disables the note input while a note is being added */
  isAddingNote?: boolean;
}

function InfoCell({
  value,
  label,
  icon,
  onClick,
}: {
  value: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="min-w-0 flex-1 overflow-hidden">
      <div className="flex flex-col justify-center">
        <div className="flex w-full min-w-0 items-center gap-1">
          {icon && (
            <span className="flex size-4 shrink-0 items-center justify-center text-ods-text-secondary">{icon}</span>
          )}
          {onClick ? (
            <button
              type="button"
              onClick={onClick}
              className="cursor-pointer truncate text-left text-ods-text-primary transition-colors text-h4 hover:text-ods-accent"
              title={value}
            >
              {value}
            </button>
          ) : (
            <span className="truncate text-ods-text-primary text-h4" title={value}>
              {value}
            </span>
          )}
        </div>
        <span className="truncate text-ods-text-secondary text-h6">{label}</span>
      </div>
    </div>
  );
}

export function TicketInfoSection({
  organization,
  device,
  status,
  statusLabel,
  statusColor,
  statusOptions,
  onStatusSelect,
  isStatusPending,
  isStatusDisabled,
  statusDisabledReason,
  onExpand,
  expanded = false,
  className,
  assigned,
  createdAt,
  description,
  attachments,
  tags,
  notes,
  onAddNote,
  onEditNote,
  onDeleteNote,
  isAddingNote,
}: TicketInfoSectionProps) {
  return (
    <div className={cn('overflow-hidden rounded-[6px] border border-ods-border', className)}>
      {/* Header row */}
      <div className="grid grid-cols-2 items-center gap-4 border-b border-ods-border bg-ods-card px-4 py-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
        {/* Organization with image */}
        <div className="flex min-w-0 items-center gap-2">
          <SquareAvatar
            src={organization?.imageSrc}
            alt={organization?.name}
            fallback={organization?.name || 'Org'}
            size="md"
            className="shrink-0"
          />
          <InfoCell value={organization?.name || 'Unassigned'} label="Organization" />
        </div>

        {/* Assigned */}
        <div className="min-w-0">
          {assigned ? (
            <AssigneeDropdown
              currentAssignee={assigned.currentAssignee}
              options={assigned.options}
              isLoading={assigned.isLoading}
              isPending={assigned.isPending}
              onAssign={assigned.onAssign}
            />
          ) : (
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-ods-text-secondary text-h4">
                <UserIcon className="size-4 shrink-0" />
                <span className="truncate">Unassigned</span>
              </div>
              <span className="block truncate text-ods-text-secondary text-h6">Assigned</span>
            </div>
          )}
        </div>

        {/* Device */}
        <InfoCell value={device?.name || 'Unassigned'} label="Device" icon={device?.icon} onClick={device?.onClick} />

        {/* Status tag + expand button */}
        <div className="flex min-w-0 items-center gap-4">
          {(status || statusLabel) && (
            <div className="min-w-0">
              <TicketStatusTag
                status={status ?? ''}
                label={statusLabel}
                color={statusColor}
                options={statusOptions}
                onSelect={onStatusSelect}
                isPending={isStatusPending}
                disabled={isStatusDisabled}
                disabledReason={statusDisabledReason}
              />
            </div>
          )}
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className={cn(
                'flex shrink-0 items-center justify-center rounded-[6px] p-3',
                'border border-ods-border bg-ods-card',
                'transition-colors duration-150 hover:bg-ods-bg-hover',
              )}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <Chevron02DownIcon
                className={cn(
                  'size-6 text-ods-text-primary transition-transform duration-200',
                  expanded && 'rotate-180',
                )}
              />
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <>
          {/* Second info row: Created */}
          {createdAt && (
            <div className="grid grid-cols-2 items-center gap-4 border-b border-ods-border bg-ods-bg px-4 py-3">
              <InfoCell value={createdAt} label="Created" />
            </div>
          )}

          {/* Content area */}
          <div className="flex flex-col gap-4 border-b border-ods-border bg-ods-bg p-4">
            {/* Description */}
            {description && <SimpleMarkdownRenderer content={description} />}

            {/* Attachments */}
            {attachments && attachments.length > 0 && (
              <TicketDetailSection label="Attachments">
                <TicketAttachmentsList attachments={attachments} />
              </TicketDetailSection>
            )}

            {/* Tags */}
            {tags && tags.length > 0 && (
              <TicketDetailSection label="Tags">
                <div className="flex min-w-0 flex-wrap gap-2">
                  {tags.map(tag => (
                    <Tag key={tag} label={tag} variant="outline" className="max-w-full" />
                  ))}
                </div>
              </TicketDetailSection>
            )}

            {/* Notes */}
            {(notes || onAddNote) && (
              <TicketDetailSection label="Notes">
                <TicketNotesSection
                  notes={notes || []}
                  onAddNote={onAddNote}
                  onEditNote={onEditNote}
                  onDeleteNote={onDeleteNote}
                  isAddingNote={isAddingNote}
                />
              </TicketDetailSection>
            )}
          </div>
        </>
      )}
    </div>
  );
}
