import { type MouseEvent, type ReactNode, useContext, useId, useRef } from 'react';
import { cn } from '../../../../utils/cn';
import { Button } from '../../../ui';
import { FloatingTooltip } from '../../../ui/floating-tooltip';
import { GridActionArmingContext, isTouchClick, TOUCH_CONFIRM_GUARD_MS } from './grid-action-arming';

/** How long a press still names the pointer of the click that follows it; a click later than this reads its own. */
const POINTER_CLICK_WINDOW_MS = 1000;

interface LastPointer {
  type: string;
  at: number;
}

interface GridRowActionProps {
  /** The table's row id: which button is armed. */
  rowId: string;
  /** `add` or `remove`, and the device's name: the control's name for a screen reader ("Add <device>"). */
  action: 'add' | 'remove';
  deviceName: string;
  icon: ReactNode;
  /** `added`: the device is in the selection (the accent check). `remove`: the Selected tab's trash. */
  tone?: 'default' | 'added' | 'remove';
  onClick?: () => void;
  disabled?: boolean;
  /** Why the device cannot be added: shown on hover and focus, since a 56px cell has no room for the text. */
  reason?: string;
}

/**
 * The add / remove control in the grid: a bare 40px icon button, the action cell being its frame (the design's
 * `action-button`). A card row draws it outlined, with a fill for "added" and the disabled reason as text beside it;
 * here "added" is the accent check and the button's tooltip says what it does to which device ("Add <device>"), with
 * the reason after it. The column is pinned right at every width while the Device column scrolls away where the table
 * is narrow (a tablet, a phone, a desktop's narrow content column), so the tooltip is what names a scrolled row's device.
 *
 * A touch screen opens no tooltip on hover and a tap would apply at once, so a finger confirms instead: the first tap
 * shows the tooltip and applies nothing, a second tap on the same button applies (one within
 * {@link TOUCH_CONFIRM_GUARD_MS} of the first is ignored). A mouse, a pen and the keyboard apply at once. A disabled
 * row's tap shows the reason; there is nothing to confirm.
 */
export function GridRowAction({
  rowId,
  action,
  deviceName,
  icon,
  tone = 'default',
  onClick,
  disabled,
  reason,
}: GridRowActionProps) {
  const { armed, arm, disarm } = useContext(GridActionArmingContext);
  // The last `pointerdown`'s pointer and when it came, read by the click that follows it (see `isTouchClick`). A gesture
  // that never became a click (a scroll, a cancelled touch) must not decide a later one: `pointercancel` clears it, and
  // a click long after the press ignores it.
  const lastPointerRef = useRef<LastPointer | undefined>(undefined);
  const bubbleId = useId();

  const label = `${action === 'add' ? 'Add' : 'Remove'} ${deviceName}`;
  const tooltip = reason ? `${label}: ${reason}` : label;
  const isArmed = armed?.rowId === rowId && armed.label === label;

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    const last = lastPointerRef.current;
    lastPointerRef.current = undefined;
    const touch = isTouchClick(event, last && Date.now() - last.at < POINTER_CLICK_WINDOW_MS ? last.type : undefined);
    if (!touch) {
      if (!onClick) return;
      disarm({ rowId, label });
      onClick();
      return;
    }
    if (!isArmed) {
      arm({ rowId, label, hint: reason ? undefined : `Tap again to ${action} ${deviceName}`, at: Date.now() });
      return;
    }
    if (!onClick || Date.now() - armed.at < TOUCH_CONFIRM_GUARD_MS) return;
    disarm({ rowId, label });
    onClick();
  };

  const handleOpenChange = (open: boolean) => {
    // Escape, a press outside or the pointer leaving closes the armed bubble; a mouse opening another row's tooltip
    // takes the place of the armed one: one bubble at a time.
    if (open) {
      if (armed && !isArmed) disarm();
    } else if (isArmed) {
      disarm({ rowId, label });
    }
  };

  const describedBy = isArmed ? bubbleId : undefined;
  const button = (
    <Button
      variant="transparent"
      size="icon"
      type="button"
      aria-label={label}
      aria-pressed={tone === 'added' ? true : undefined}
      aria-describedby={reason ? undefined : describedBy}
      onClick={reason ? undefined : handleClick}
      leftIcon={icon}
      className={cn(
        'size-10 border-0 md:size-10',
        tone === 'added' && 'text-ods-accent hover:text-ods-accent',
        tone === 'remove' && 'text-ods-error hover:opacity-80',
        tone === 'default' && 'text-ods-text-secondary hover:text-ods-text-primary',
      )}
      disabled={disabled}
    />
  );
  return (
    <div
      data-no-row-click
      className="pointer-events-auto flex items-center justify-center"
      onPointerDown={event => {
        lastPointerRef.current = { type: event.pointerType, at: Date.now() };
      }}
      onPointerCancel={() => {
        lastPointerRef.current = undefined;
      }}
    >
      <FloatingTooltip
        content={tooltip}
        side="left"
        as="span"
        triggerClassName="inline-flex"
        open={isArmed || undefined}
        onOpenChange={handleOpenChange}
        mouseOnly
        contentId={bubbleId}
      >
        {reason ? (
          // A disabled button takes no hover, focus or tap: the wrapper is what the tooltip listens on.
          <span
            tabIndex={0}
            aria-label={tooltip}
            aria-describedby={describedBy}
            className="inline-flex rounded-md outline-none"
            onClick={handleClick}
          >
            {button}
          </span>
        ) : (
          button
        )}
      </FloatingTooltip>
    </div>
  );
}
