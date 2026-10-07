'use client';

import type { ReactNode } from 'react';
import {
  AppLayoutDrawer,
  AppLayoutDrawerBody,
  AppLayoutDrawerContent,
  AppLayoutDrawerDescription,
  AppLayoutDrawerHeader,
  AppLayoutDrawerTitle,
} from '../../navigation/app-layout-drawer';
import { Tag, type TagProps } from '../../ui/tag';
import { TruncateText } from '../../ui/truncate-text';

/** What the drawer shows for a field the record does not have. */
const EMPTY_MARK = '—';

function EmptyMark() {
  return <span className="text-ods-text-secondary">{EMPTY_MARK}</span>;
}

export interface LogDrawerInfoField {
  label: string;
  value: string | ReactNode;
}

export interface LogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  description: ReactNode;
  statusTag?: {
    label: string;
    variant?: TagProps['variant'];
  };
  timestamp?: string;
  infoFields?: LogDrawerInfoField[];
  /** The device the log belongs to, pinned to the bottom. The host renders the card. */
  deviceCard?: ReactNode;
  /** Drawn under the info card, for example a Copy action. */
  children?: ReactNode;
  /**
   * The drawer sits in a box of its own beside the content instead of over it:
   * no backdrop. The box is the element `AppLayoutDrawerContainerContext`
   * provides (a positioned element the host renders next to the table).
   */
  docked?: boolean;
}

export function LogDrawer({
  isOpen,
  onClose,
  description,
  statusTag,
  timestamp,
  infoFields,
  deviceCard,
  children,
  docked = false,
}: LogDrawerProps) {
  return (
    <AppLayoutDrawer
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      {/* md:w matches the mobileBreakpoint: below it the panel is forced
          full-bleed, so a fixed width there would detach it from the right edge */}
      <AppLayoutDrawerContent
        side="right"
        className="md:w-[400px]"
        overlayClassName={docked ? 'hidden' : undefined}
        dismissOnInteractOutside={docked ? false : undefined}
      >
        {/* Header: title, status and time only. The log text itself goes in the
            body. The header is not a scroll region and the panel clips, so a long
            log up here grew past the panel and squeezed the body to nothing: the
            wheel had nothing to scroll and the end of the log was unreachable. */}
        <AppLayoutDrawerHeader>
          <AppLayoutDrawerTitle>Log Details</AppLayoutDrawerTitle>

          {(statusTag || timestamp) && (
            <div className="flex items-center gap-2">
              {statusTag && <Tag label={statusTag.label} variant={statusTag.variant} />}
              {timestamp && <span className="text-ods-text-secondary text-h6">{timestamp}</span>}
            </div>
          )}
        </AppLayoutDrawerHeader>

        {/* Body */}
        <AppLayoutDrawerBody>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {/* The log text: still the dialog's accessible description, rendered
                inside the scroll region. `asChild` makes the slot a div, so the
                content may hold block elements (the loading skeleton). */}
            {description && (
              <AppLayoutDrawerDescription asChild className="leading-6 text-ods-text-primary text-h4">
                <div>{description}</div>
              </AppLayoutDrawerDescription>
            )}
            {/* Info card: vertical fields, the value on top and its label below */}
            {infoFields && infoFields.length > 0 && (
              <div className="grid grid-cols-1 gap-3 rounded-[6px] border border-ods-border bg-ods-card p-4">
                {infoFields.map(field => (
                  <div key={typeof field.label === 'string' ? field.label : ''} className="grid grid-cols-1 gap-0.5">
                    {typeof field.value === 'string' ? (
                      field.value === '' || field.value === EMPTY_MARK ? (
                        <span className="text-h4">
                          <EmptyMark />
                        </span>
                      ) : (
                        <TruncateText>{field.value}</TruncateText>
                      )
                    ) : (
                      <span className="truncate text-ods-text-primary text-h4">{field.value || <EmptyMark />}</span>
                    )}
                    <span className="truncate text-ods-text-secondary text-h6">{field.label}</span>
                  </div>
                ))}
              </div>
            )}
            {children}
          </div>

          {/* The device card, pinned to the bottom: outside the scroll region, so
              it never scrolls away with a long log. */}
          {deviceCard && <div className="mt-auto">{deviceCard}</div>}
        </AppLayoutDrawerBody>
      </AppLayoutDrawerContent>
    </AppLayoutDrawer>
  );
}
