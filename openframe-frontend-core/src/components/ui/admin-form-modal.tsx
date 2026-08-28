'use client';

import { useId, type ReactNode } from 'react';
import { Button } from './button';
import { UnsavedChangesChip, useGuardedClose } from './modal-guarded-close';
import {
  ModalV2,
  ModalV2Content,
  ModalV2Footer,
  ModalV2Header,
  ModalV2Title,
  ModalV2TwoColumn,
  type ModalV2Size,
} from './modal-v2';
import { Skeleton } from './skeleton';

/**
 * Label widths for the loading placeholder. Uneven on purpose — a column of
 * identical bars reads as a rendering artifact rather than a form arriving.
 */
const SKELETON_FIELD_WIDTHS = ['w-24', 'w-32', 'w-20', 'w-40', 'w-28', 'w-36'];

/** Layout: pass `children` for one column, or `leftColumn`+`rightColumn` for two. */
type AdminFormModalLayout =
  | { children: ReactNode; leftColumn?: never; rightColumn?: never }
  | { leftColumn: ReactNode; rightColumn: ReactNode; children?: never };

type AdminFormModalBaseProps = {
  title: ReactNode;
  /** Secondary line under the title (what this record is, why it matters). */
  subtitle?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
  canSave?: boolean;
  saving?: boolean;
  /**
   * The entity is still being fetched — the modal was opened from a URL on a
   * cold load, so there is no list row to borrow from. Content is hidden behind
   * a placeholder and Save is held until the form has real values to submit.
   */
  loading?: boolean;
  error?: string | null;
  /**
   * Placeholder to show while `loading`, for modals whose body is NOT a field
   * grid. The default bars imply a form; a modal that resolves into a list or a
   * table would visibly change shape when the data lands.
   */
  loadingContent?: ReactNode;
  /** Secondary actions pinned to the footer's LEFT edge (Delete, Preview…). */
  footerExtras?: ReactNode;
  /**
   * Additional PRIMARY actions, rendered next to Save (Publish, Mark
   * Complete…). A second primary action put in `footerExtras` lands at the far
   * left, a whole modal-width away from the button it belongs beside.
   */
  footerActions?: ReactNode;
  /** Status text between the extras and the buttons (e.g. "3 rules selected"). */
  footerStatus?: ReactNode;
  /** Unsaved edits exist: shows the footer chip and guards close with a confirm. */
  dirty?: boolean;
  /** Names WHAT is dirty (chip tooltip) — turns "why is this dirty?!" into a hover. */
  dirtyDetail?: string;
  /**
   * Panel width. Two-column layouts are always `wide` — passing
   * `leftColumn`/`rightColumn` upgrades this automatically.
   */
  size?: ModalV2Size;
  contentClassName?: string;
};

/**
 * THE admin form-modal shell: header, scrolling content (one column or two), an
 * error line, and a Cancel/Save footer with optional extra actions.
 *
 * Every admin form modal renders this rather than reassembling `ModalV2` +
 * header + footer by hand. Three copies of the same shell had already been
 * written in one feature (repo form, rule form, bindings), which is how the
 * Save button ends up saying "Saving…" in one place and spinning silently in
 * another.
 *
 * Width is a `size` variant, never a call-site `max-w-*` — the widths had
 * drifted across seven values (`max-w-md` through `max-w-[1400px]`) for modals
 * doing the same job.
 */
export function AdminFormModal({
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
  loadingContent,
  footerExtras,
  footerActions,
  footerStatus,
  dirty = false,
  dirtyDetail,
  size,
  contentClassName = 'space-y-[var(--spacing-system-lf)]',
  children,
  leftColumn,
  rightColumn,
}: AdminFormModalBaseProps & AdminFormModalLayout) {
  const twoColumn = leftColumn !== undefined && rightColumn !== undefined;
  const effectiveSize: ModalV2Size = twoColumn ? 'wide' : (size ?? 'medium');
  /** Placeholder column count follows the panel width so the skeleton occupies
   *  the same shape the real content will. */
  const skeletonColumns = effectiveSize === 'wide' ? 2 : 1;
  const formId = useId();
  // The lib's unified dirty-state contract: closing a dirty settings form must
  // never silently discard the edits — `useGuardedClose` asks the house
  // confirm (ModalV2, never window.confirm) before running `onClose`.
  const { guardedClose, dialog } = useGuardedClose(dirty, onClose, {
    title: 'Discard unsaved changes?',
    body: 'Your edits have not been saved. Close and discard them?',
  });
  // NO field autofocus here. `ModalV2` owns focus now (focus-in on open, focus
  // containment while topmost, Tab trap, restore to the opener), so the shell
  // reaching in to focus "the first field" only fought it — and picked widgets
  // that ACT on focus: the author selector's combobox opened its popover on
  // every `?edit=<id>` load, and on a cold URL load the programmatic focus had
  // no preceding pointer event, so the UA painted a focus ring too. Focus lands
  // on the dialog itself, which is the correct dialog behavior; the first Tab
  // reaches the first field.
  if (!isOpen) return null;

  return (
    <ModalV2 isOpen onClose={guardedClose} size={effectiveSize}>
      <ModalV2Header>
        <ModalV2Title>{title}</ModalV2Title>
        {/* A <div>, not a <p>. `subtitle` is a ReactNode and callers legitimately
            pass badges and chips — `Badge` renders a <div>, which is invalid
            inside <p>. The browser then re-parents it during hydration and React
            throws a mismatch (seen on role-baselines, whose subtitle carries a
            weight Badge). Typography is unchanged. */}
        {subtitle && <div className="text-ods-text-secondary text-h6">{subtitle}</div>}
      </ModalV2Header>

      {/* A real <form>: Enter in a text input previously did nothing in every
          admin modal routed through this shell. */}
      <form
        id={formId}
        // Inherit the ModalV2 flex chain — an unstyled form between the shell
        // and ModalV2Content made flex-1/min-h-0 inert, so tall modals pushed
        // the Cancel/Save footer past 90vh.
        className="flex min-h-0 flex-1 flex-col"

        onSubmit={e => {
          e.preventDefault();
          if (canSave && !saving) onSave();
        }}
        // Some modals contain a FILTER input, not a form field. Enter there must
        // not ship the save — in the bindings modal that would commit an
        // absolute-state rule-set replacement mid-search.
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.target as HTMLElement)?.dataset?.noSubmitOnEnter === 'true') {
            e.preventDefault();
          }
        }}
      >
        {loading ? (
          // NOT `contentClassName` — that describes the real content's layout
          // (master-detail modals pass `flex`, which turns the placeholder into
          // a shrink-to-fit flex item pinned to the left of a 1400px panel).
          // The placeholder owns its own layout and mirrors the column count so
          // the modal doesn't visibly re-flow when the entity lands.
          <ModalV2Content>
            {loadingContent ? (
              <div aria-busy="true">{loadingContent}</div>
            ) : (
              <div
                aria-busy="true"
                className={
                  // Mirrors the PANEL WIDTH, not the slot API. `wide` covers the
                  // master-detail modals too (seo-redirect, managed-repo,
                  // exclusions) — they pass `children`, so keying on `twoColumn`
                  // drew one column of full-width bars across 1400px, which reads
                  // as a broken form rather than a loading one.
                  skeletonColumns === 2
                    ? 'grid grid-cols-1 gap-[var(--spacing-system-xl)] lg:grid-cols-2'
                    : 'grid grid-cols-1 gap-[var(--spacing-system-xl)]'
                }
              >
                <span className="sr-only">Loading…</span>
                {Array.from({ length: skeletonColumns }, (_, col) => (
                  <div key={col} className="space-y-[var(--spacing-system-lf)]" aria-hidden="true">
                    {SKELETON_FIELD_WIDTHS.map((labelWidth, i) => (
                      <div key={i} className="space-y-[var(--spacing-system-xsf)]">
                        <Skeleton className={`h-4 ${labelWidth}`} />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </ModalV2Content>
        ) : twoColumn ? (
          <ModalV2TwoColumn left={leftColumn} right={rightColumn} />
        ) : (
          <ModalV2Content className={contentClassName}>{children}</ModalV2Content>
        )}
        {/* Outside the scrolling region(s): in a two-column modal an error
            belongs to the save, not to either column, and must stay visible
            wherever each column happens to be scrolled to. */}
        {error && (
          <p role="alert" className="shrink-0 text-ods-error text-h6">
            {error}
          </p>
        )}
      </form>

      <ModalV2Footer>
        <div className="flex w-full items-center justify-between gap-[var(--spacing-system-xsf)]">
          <div className="flex items-center gap-[var(--spacing-system-xsf)]">{footerExtras}</div>
          <div className="flex items-center gap-[var(--spacing-system-xsf)]">
            {footerStatus}
            {dirty && <UnsavedChangesChip detail={dirtyDetail} />}
            {footerActions}
            <Button variant="outline" size="small-legacy" onClick={guardedClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="small-legacy"
              type="submit"
              form={formId}
              // NO `onClick` — the `form` association is the single activation
              // path. Carrying both fired `onSave()` twice per click (the click
              // handler, then the form's default submit), and the pending-state
              // guard cannot catch it because React Query's re-render happens a
              // microtask later. On the create path that meant two POSTs and two
              // registry rows with the same name.
              loading={saving}
              disabled={saving || loading || !canSave}
            >
              {saveLabel}
            </Button>
          </div>
        </div>
      </ModalV2Footer>
      {dialog}
    </ModalV2>
  );
}
