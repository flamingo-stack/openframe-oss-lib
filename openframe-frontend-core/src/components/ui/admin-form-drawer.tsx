'use client';

import { useId, useState, type ReactNode } from 'react';
import { HUBSPOT_DO_NOT_COLLECT_FORM_PROPS } from '../../utils/hubspot-collected-forms';
import { Button } from './button';
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from './drawer';
import { UnsavedChangesChip } from './modal-guarded-close';
import { Skeleton } from './skeleton';

const SKELETON_FIELD_WIDTHS = ['w-24', 'w-32', 'w-20', 'w-40', 'w-28', 'w-36'];

export interface AdminFormDrawerProps {
  title: ReactNode;
  /** Secondary line under the title (what this record is, why it matters). */
  subtitle?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
  canSave?: boolean;
  saving?: boolean;
  /** The record is still being fetched: the body is a placeholder and Save is held. */
  loading?: boolean;
  error?: string | null;
  /** Secondary actions at the footer's left edge (Delete, Preview). */
  footerExtras?: ReactNode;
  /** Additional primary actions, beside Save. */
  footerActions?: ReactNode;
  /** Status text between the extras and the buttons. */
  footerStatus?: ReactNode;
  /** Unsaved edits exist: shows the footer chip and asks before closing. */
  dirty?: boolean;
  /** Names WHAT is dirty (the chip's tooltip). */
  dirtyDetail?: string;
  /** Initial panel width in px; the admin can drag it wider, and the width is remembered per `storageKey`. */
  defaultWidth?: number;
  /** localStorage key for the remembered width. */
  storageKey?: string;
  children: ReactNode;
}

/**
 * THE admin form DRAWER: the same contract as `AdminFormModal` (title, a real
 * `<form>`, an error line, a Cancel / Save footer, the unsaved-changes guard)
 * in the right-side `Drawer`, for editors too long or too dense for a modal.
 * The list behind it stays visible, and the panel can be dragged wider.
 *
 * Closing with unsaved edits asks IN the footer (Keep editing / Discard): a
 * confirm dialog would open underneath the drawer, which sits above modals.
 */
export function AdminFormDrawer({
  title,
  subtitle,
  isOpen,
  onClose,
  onSave,
  saveLabel,
  canSave = true,
  saving = false,
  loading = false,
  error = null,
  footerExtras,
  footerActions,
  footerStatus,
  dirty = false,
  dirtyDetail,
  defaultWidth = 760,
  storageKey,
  children,
}: AdminFormDrawerProps) {
  const formId = useId();
  const [confirming, setConfirming] = useState(false);
  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirming(true);
    else onClose();
  };

  return (
    <Drawer
      open={isOpen}
      onOpenChange={open => {
        if (!open) requestClose();
      }}
    >
      {/* Below `md` the handle is off and the panel takes the whole screen width. */}
      <DrawerContent
        side="right"
        resizable
        defaultSize={defaultWidth}
        minSize={480}
        storageKey={storageKey}
        panelClassName="max-md:w-[calc(100vw-1rem)]"
      >
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {subtitle && (
            <DrawerDescription asChild>
              <div>{subtitle}</div>
            </DrawerDescription>
          )}
        </DrawerHeader>

        <DrawerBody>
          <form
            id={formId}
            {...HUBSPOT_DO_NOT_COLLECT_FORM_PROPS}
            className="flex flex-col gap-[var(--spacing-system-lf)]"
            onSubmit={e => {
              e.preventDefault();
              if (canSave && !saving) onSave();
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.target as HTMLElement)?.dataset?.noSubmitOnEnter === 'true') {
                e.preventDefault();
              }
            }}
          >
            {loading ? (
              <div aria-busy="true" className="flex flex-col gap-[var(--spacing-system-lf)]">
                <span className="sr-only">Loading</span>
                {SKELETON_FIELD_WIDTHS.map((labelWidth, i) => (
                  <div key={i} className="space-y-[var(--spacing-system-xsf)]" aria-hidden="true">
                    <Skeleton className={`h-4 ${labelWidth}`} />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              children
            )}
          </form>
        </DrawerBody>

        {error && (
          <p role="alert" className="shrink-0 text-ods-error text-h6">
            {error}
          </p>
        )}

        <div className="flex shrink-0 items-center justify-between gap-[var(--spacing-system-xsf)] border-t border-ods-border pt-[var(--spacing-system-mf)]">
          {confirming ? (
            <>
              <span className="text-ods-text-primary text-h6">Discard unsaved changes?</span>
              <div className="flex items-center gap-[var(--spacing-system-xsf)]">
                <Button variant="outline" size="small-legacy" onClick={() => setConfirming(false)}>
                  Keep editing
                </Button>
                <Button
                  variant="destructive"
                  size="small-legacy"
                  onClick={() => {
                    setConfirming(false);
                    onClose();
                  }}
                >
                  Discard
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-[var(--spacing-system-xsf)]">{footerExtras}</div>
              <div className="flex items-center gap-[var(--spacing-system-xsf)]">
                {footerStatus}
                {dirty && <UnsavedChangesChip detail={dirtyDetail} />}
                {footerActions}
                <Button variant="outline" size="small-legacy" onClick={requestClose} disabled={saving}>
                  Cancel
                </Button>
                {/* No onClick: the `form` association is the single activation path. */}
                <Button
                  size="small-legacy"
                  type="submit"
                  form={formId}
                  loading={saving}
                  disabled={saving || loading || !canSave}
                >
                  {saveLabel}
                </Button>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
