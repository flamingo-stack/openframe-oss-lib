/**
 * Single CSS string for chip-density action buttons (Recent / Search /
 * Find / Display, plus the inline Display popover's submit / cancel
 * buttons).
 *
 * Shared between the empty-state chip's action row and the
 * `<DisplayChipAction>` popover so both render with byte-equivalent
 * styling — no per-call ad-hoc Tailwind chain that drifts over time.
 *
 * Sizing intent: 11px font + tight `px-2 py-1` padding lands below UI-Kit
 * `Button size="small"` (24-32px min-height). These are chip-density
 * action buttons, not standard buttons — they sit inside the empty-state
 * chip card's tertiary action row.
 */
export const CHIP_ACTION_BUTTON_CLASS =
  'text-h6 text-ods-text-secondary hover:text-ods-text-primary ' +
  'bg-transparent hover:bg-ods-card-hover border border-ods-border rounded-md ' +
  'px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ods-focus'
