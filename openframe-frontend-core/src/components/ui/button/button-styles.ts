// Shared style atoms for `Button` and `SplitButton`. Extracted to keep a single
// source of truth for surface colors, outline borders, and split-divider colors.

// Each variant pairs `disabled:` (real `<button disabled>`) with `aria-disabled:`
// (used for `<Link aria-disabled>` since anchors don't support `:disabled`).
export const buttonSurfaceClasses = {
  accent:
    'bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent-hover active:bg-ods-accent-active disabled:bg-ods-disabled aria-disabled:bg-ods-disabled',
  // `data-tone="accent"`: the accent fill on hover (a card's "view" action).
  outline:
    'bg-ods-card text-ods-text-primary hover:bg-ods-bg-hover active:bg-ods-bg-active disabled:bg-ods-card disabled:text-ods-text-disabled aria-disabled:bg-ods-card aria-disabled:text-ods-text-disabled data-[tone=accent]:hover:bg-ods-accent',
  transparent:
    'bg-transparent text-ods-text-primary hover:bg-ods-bg-hover active:bg-ods-bg-active disabled:bg-transparent disabled:text-ods-text-disabled aria-disabled:bg-transparent aria-disabled:text-ods-text-disabled',
  destructive:
    'bg-ods-error text-ods-text-on-accent hover:bg-ods-error-hover active:bg-ods-error-active disabled:bg-ods-disabled aria-disabled:bg-ods-disabled',
  warning:
    'bg-ods-warning text-ods-text-on-accent hover:bg-ods-warning-hover active:bg-ods-warning-active disabled:bg-ods-disabled aria-disabled:bg-ods-disabled',
  // The page's colours swapped: light on a dark theme, dark on a light one. A
  // strong action that must NOT be the accent, for a surface that already
  // holds the one accent call to action (an "Approve" inside a product demo).
  inverted:
    'bg-ods-text-primary text-ods-bg hover:bg-ods-text-secondary active:bg-ods-text-secondary disabled:bg-ods-disabled aria-disabled:bg-ods-disabled',
  // A self-contained glyph (play badge, unmute glyph) that already carries its
  // own scrim: no button surface at all, in any state. Distinct from
  // `transparent`, whose hover/active fills would paint a rectangle behind the
  // glyph — which is why call sites were undoing them with
  // `hover:bg-transparent active:bg-transparent`.
  glyph:
    'bg-transparent text-ods-text-primary hover:bg-transparent active:bg-transparent disabled:bg-transparent disabled:text-ods-text-disabled aria-disabled:bg-transparent aria-disabled:text-ods-text-disabled',
  // A quiet inline text action (a "Show all" / "Show less" disclosure, a
  // secondary "Clear" beside a field): secondary text that takes the accent on
  // hover, and no surface in any state. Promoted to a variant because the
  // disclosure toggle was a primitive <button> restating these classes. Pair
  // with size="compact" and noPaddingX so the label aligns with the text above.
  //
  // States, from the element's attributes: `data-state="active"` holds the accent (a filter trigger with filters
  // applied). `data-tone="neutral"` takes the primary text on hover instead of the accent (a secondary text action:
  // "Select all", "Mark all read"); `data-tone="primary"` sits in the primary text and takes the accent on hover (a
  // value that opens something: an info row's link, a breadcrumb).
  link: [
    'bg-transparent text-ods-text-secondary hover:bg-transparent hover:text-ods-accent active:bg-transparent active:text-ods-accent-active disabled:bg-transparent disabled:text-ods-text-disabled aria-disabled:bg-transparent aria-disabled:text-ods-text-disabled',
    'data-[tone=neutral]:hover:text-ods-text-primary',
    'data-[tone=primary]:text-ods-text-primary data-[tone=primary]:hover:text-ods-accent',
    'data-[state=active]:text-ods-accent data-[state=active]:hover:text-ods-accent data-[tone=neutral]:data-[state=active]:hover:text-ods-accent',
  ].join(' '),
  // A bare glyph control with no surface (a composer's send / add-context, a copy, a close, a field's clear): the
  // secondary text, the primary on hover and keyboard focus, faded when disabled. Distinct from `transparent`, which
  // is primary text on a hover fill. States, from the element's attributes:
  //  - `aria-expanded="true"`: its popup is open, the glyph stays lit (primary);
  //  - `data-state="active"`: the glyph is armed (the composer's send while the editor has focus), the accent;
  //  - `data-tone="accent"`: a trigger that opens and presses in the accent (the composer's add-context);
  //  - `data-tone="danger"`: a removal that takes the error colour on hover;
  //  - `data-tone="error"` / `data-tone="success"`: a glyph drawn in that colour (an error's copy, a done state),
  //    dimmed on hover;
  //  - `data-tone="field"`: a field's adornment, lit in the accent while the field (the enclosing `group`) has focus
  //    and in the error colour while it is invalid (`data-invalid` on the group).
  bare: [
    'bg-transparent text-ods-text-secondary outline-none hover:bg-transparent hover:text-ods-text-primary focus-visible:text-ods-text-primary active:bg-transparent',
    'aria-expanded:text-ods-text-primary',
    'data-[state=active]:text-ods-accent',
    'data-[tone=accent]:aria-expanded:text-ods-accent data-[tone=accent]:active:text-ods-accent',
    'data-[tone=danger]:hover:text-ods-error',
    'data-[tone=error]:text-ods-error data-[tone=error]:hover:text-ods-error data-[tone=error]:hover:opacity-80',
    'data-[tone=success]:text-ods-success data-[tone=success]:hover:text-ods-success data-[tone=success]:hover:opacity-80',
    'data-[tone=field]:group-has-[textarea:focus]:text-ods-accent data-[tone=field]:focus-visible:text-ods-accent data-[tone=field]:group-data-[invalid]:text-ods-error',
    'disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40 disabled:hover:text-ods-text-secondary aria-disabled:opacity-40',
  ].join(' '),
  // Chrome that sits ON media (video cards, image lightboxes): a scrim disc so
  // the glyph stays legible over an arbitrary frame. Promoted to a variant
  // because the walkthrough card, its theater and the bite cards were each
  // stacking the same classes at the call site.
  overlay:
    'rounded-full bg-ods-overlay text-ods-text-primary backdrop-blur-sm hover:text-ods-accent active:text-ods-accent-active disabled:text-ods-text-disabled aria-disabled:text-ods-text-disabled',
} as const;

export const outlineBorderClasses =
  'border border-ods-border hover:border-ods-border-hover active:border-ods-border-active disabled:border-ods-border aria-disabled:border-ods-border';

// Glyph scale for the split-layout button family: 16px below md, 24px from md.
//
// Shared because the same page-header action renders through EITHER of the two
// split layouts depending on its shape — `SplitButton` for two click targets, and
// `Button` + `splitIcon` for one with a decorative trailing glyph — and the two sit
// side by side in the same row. They used to disagree: `SplitButton` carried this
// responsive scale while the `Button` split slots re-declared a flat 20px, so a
// "submenu" action's icons rendered 4px smaller than its neighbour's on desktop.
// `Button`'s own flat `[&_svg]:h-5` stays as it is for ordinary (non-split) buttons.
export const splitGlyphSizeClasses = '[&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-6 md:[&_svg]:w-6';

// Per-size glyph scale for `Button`'s split slots AND the loading overlay that
// covers them, so those two read from ONE place — the overlay sits outside both
// slots and inherits neither their sizing nor a shell base rule, so without this it
// would have to restate a number, which is the divergence described above.
//
// Scoped to `Button` on purpose: `SplitButton` keeps its own `small` ramp
// (12px → 16px, vs the flat 16px here) and only shares the `default` step through
// `splitGlyphSizeClasses`. Aligning `small` too is a visible design change, so it is
// not folded in here silently.
export const splitGlyphSizeBySize = {
  default: splitGlyphSizeClasses,
  small: '[&_svg]:h-4 [&_svg]:w-4',
} as const;

// Color of the vertical seam between the main and icon halves (split layouts).
export const splitDividerColorClasses = {
  accent: 'border-ods-accent-active',
  outline: 'border-ods-border',
  transparent: 'border-ods-border',
  destructive: 'border-ods-error-active',
  warning: 'border-ods-warning-active',
} as const;

export type ButtonSurfaceVariant = keyof typeof buttonSurfaceClasses;

/**
 * A button's box per size (height, padding, label type, glyph size): read by `buttonVariants` and by
 * `InteractiveSkeleton.Button`'s `size`, so a button's skeleton is the button's box at every breakpoint.
 */
export const BUTTON_SIZE_CLASS = {
  default: 'h-11 px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] text-h3 md:h-12',
  small: 'h-6 p-[var(--spacing-system-xs)] text-h5 md:h-8',
  // The CHILD is the affordance (a badge, a chip, a thumbnail): the button
  // contributes the hit target, the focus ring and the keyboard/ARIA
  // semantics, and NO box of its own. Without this, call sites reached for
  // a `className="h-auto p-0"` override to cancel the default box.
  wrap: 'h-auto p-0',
  'small-legacy': 'h-10 px-[var(--spacing-system-m)] py-[var(--spacing-system-xs)] text-[14px] font-bold', // Temporary alias for "small" — deprecated; grep size="small-legacy" (lib + hub) and migrate the remaining consumers before removal
  // 24px pill for slim strips (announcement/promo bars, inline banner
  // actions — Primer banner / Polaris banner / Vercel-bar convention).
  // The label matches the strip's MESSAGE type ramp exactly (DM Sans
  // regular, 13px -> md:14px, snug leading — the announcement bar's
  // subtitle styling): in-strip CTAs must never read louder than the
  // message beside them, so this deliberately uses neither the
  // mono-uppercase control style of "small" nor a heavier weight.
  // Pinned h-6 across breakpoints (24px = the WCAG 2.5.8 target-size
  // floor) with horizontal-dominant padding and a 14px glyph.
  compact: 'h-6 px-[var(--spacing-system-sf)] py-0 font-normal text-h6 [&_svg]:h-3.5 [&_svg]:w-3.5',
  icon: 'h-11 w-11 p-[var(--spacing-system-sf)] md:h-12 md:w-12 [&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-6 md:[&_svg]:w-6',
  // Quiet 32px icon target with a 16px glyph, fixed across breakpoints
  // (Carbon ghost sm / Primer medium / shadcn icon-sm all pin 32px;
  // ≥ the 24px WCAG 2.5.8 target floor). For icon actions that read as
  // metadata rather than CTAs — author-page social rows, share rows.
  // Pair with variant="transparent" for the ghost treatment.
  // `BUTTON_ICON_SM_SIZE` states the same 32px for a layout that must clear one.
  'icon-sm': 'h-8 w-8 p-[var(--spacing-system-xxs)] [&_svg]:h-4 [&_svg]:w-4',
  // 20px inline glyph for affordances that sit INSIDE a line of text —
  // an info hint beside a badge, a copy glyph after an id. `icon-sm`'s
  // 32px target is correct for a metadata row but visually swamps a
  // 10px badge or a 14px label, so hosts were reaching for className
  // overrides to shrink it. Below the WCAG 2.5.8 target floor on purpose:
  // this is only for glyphs whose information is ALSO available another
  // way (tooltip content mirrored into an aria-describedby node), never
  // for a sole means of performing an action.
  'icon-inline': 'h-5 min-h-0 w-5 min-w-0 shrink-0 p-0 [&_svg]:h-3.5 [&_svg]:w-3.5',
  // Bare 56px media glyph (play / unmute over video). A size variant so
  // hosts stop re-implementing a <button> to escape the 20px svg cap.
  'icon-glyph': 'h-14 w-14 p-0 [&_svg]:h-14 [&_svg]:w-14',
} as const;

export type ButtonSizeKey = keyof typeof BUTTON_SIZE_CLASS;

const KIND_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus';
const KIND_FOCUS_INSET =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus';

/**
 * The button KINDS that are not a plain push button: each owns its whole box and look, which no `size` changes, and
 * is reused by every control of its kind. A kind's selected / open / invalid state is read from the element's own
 * attributes, never from a class at the call site:
 *
 *  - `data-state="active"` (Radix's convention): the selected row, tab or chip;
 *  - `data-state="open"` / `aria-expanded="true"`: the field whose popup is open;
 *  - `data-invalid`: the field that failed validation (the marker every field exposes);
 *  - `aria-pressed="true"`: the pressed chip;
 *  - `aria-selected="true"`: the chosen field (a choice drawn as a field);
 *  - `aria-busy="true"`: the rail entry whose route is committing.
 *
 * Where a kind has a second look for the same state (a selected row marked with the accent rather than the hover
 * surface, the segmented control's accent segment), the control names it with `data-tone`, declared on the kind below.
 *
 * A call site's `className` on a kind is layout only (width, flex, position, margin): never a colour.
 */
export const BUTTON_KIND_CLASS = {
  // A control drawn as a form field (a date picker's, a searchable select's, a popup's trigger): Input's box, border
  // and states, the value on the left.
  field: [
    'flex w-full items-center gap-[var(--spacing-system-xsf)] border px-[var(--spacing-system-sf)] text-left',
    'h-11 rounded-[6px] md:h-12',
    'border-ods-border bg-ods-card text-ods-text-primary text-h4 transition-colors duration-200',
    'enabled:hover:border-ods-border-hover enabled:hover:bg-ods-bg-hover enabled:active:border-ods-border-active enabled:active:bg-ods-bg-active',
    // Open: the accent border, held under the cursor (a hover must not read as closing it).
    'data-[state=open]:border-ods-accent aria-expanded:border-ods-accent',
    'enabled:data-[state=open]:hover:border-ods-accent enabled:aria-expanded:hover:border-ods-accent',
    // Selected (a choice drawn as a field, `aria-selected="true"`): the accent border on the accent's light fill,
    // whose hover and press are the fill's own steps.
    'aria-selected:border-ods-accent aria-selected:bg-ods-open-yellow-light',
    'enabled:aria-selected:hover:border-ods-accent enabled:aria-selected:hover:bg-ods-open-yellow-light-hover',
    'enabled:aria-selected:active:border-ods-accent enabled:aria-selected:active:bg-ods-open-yellow-light-action',
    // Invalid wins over open.
    'data-[invalid]:border-ods-error enabled:data-[invalid]:hover:border-ods-error enabled:data-[invalid]:active:border-ods-error',
    'data-[invalid]:data-[state=open]:border-ods-error data-[invalid]:aria-expanded:border-ods-error',
    'enabled:data-[invalid]:data-[state=open]:hover:border-ods-error enabled:data-[invalid]:aria-expanded:hover:border-ods-error',
    'disabled:cursor-not-allowed disabled:bg-ods-bg disabled:text-ods-text-disabled [&_svg]:disabled:text-ods-text-disabled',
    'outline-none focus-visible:border-ods-accent',
    '[&_svg]:shrink-0',
  ].join(' '),
  // A clickable row of a list, a menu or a navigation: full width, its content on the left, the hover and the
  // selected surface of the list. The selected row (`data-state="active"`) takes the hover surface; a list that marks
  // its selection differently names its look with `data-tone` (the attribute, on the row and on its skeleton):
  //  - `accent`: the accent's secondary fill, no hover surface (a chat list's open conversation);
  //  - `link`: the accent text, no surface at all (a chat rail's navigation entries);
  //  - `surface`: the raised surface, the hover still showing over it (a filter dropdown's checked option);
  //  - `muted`: the border-grey fill, held under the cursor (a timeline's current event, a docs tree's open page);
  //  - `card`: a card with its border, no hover over it; idle rows keep a transparent border (a capability list);
  //  - `framed`: every row a bordered card, the selected one with the accent border (the mobile menu's entries).
  row: [
    'flex w-full items-center gap-[var(--spacing-system-s)] rounded-md px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] text-left',
    'bg-transparent text-ods-text-primary text-h4 transition-colors duration-150',
    'hover:bg-ods-bg-hover active:bg-ods-bg-active data-[state=active]:bg-ods-bg-hover',
    'data-[tone=accent]:hover:bg-transparent data-[tone=accent]:active:bg-transparent',
    'data-[tone=accent]:data-[state=active]:bg-ods-accent-secondary data-[tone=accent]:data-[state=active]:hover:bg-ods-accent-secondary data-[tone=accent]:data-[state=active]:active:bg-ods-accent-secondary',
    'data-[tone=link]:hover:bg-transparent data-[tone=link]:active:bg-transparent data-[tone=link]:data-[state=active]:bg-transparent data-[tone=link]:data-[state=active]:text-ods-accent',
    'data-[tone=surface]:data-[state=active]:bg-ods-bg-surface data-[tone=surface]:data-[state=active]:hover:bg-ods-bg-hover',
    'data-[tone=muted]:data-[state=active]:bg-ods-border',
    'data-[tone=card]:border data-[tone=card]:border-transparent data-[tone=card]:data-[state=active]:border-ods-border data-[tone=card]:data-[state=active]:bg-ods-card',
    'data-[tone=framed]:border data-[tone=framed]:border-ods-border data-[tone=framed]:bg-ods-card data-[tone=framed]:data-[state=active]:border-ods-accent data-[tone=framed]:data-[state=active]:bg-ods-card data-[tone=framed]:data-[state=active]:hover:bg-ods-bg-hover',
    'disabled:cursor-not-allowed disabled:text-ods-text-disabled disabled:hover:bg-transparent',
    KIND_FOCUS_INSET,
    '[&_svg]:shrink-0',
  ].join(' '),
  // A navigation rail's entry (the app sidebar): the row's box with the rail's two layers. The hover is a wash on its
  // own layer (`::after`), so it can fade while the current page switches in a single frame: the current page's entry
  // (`data-state="active"`) takes the accent's light fill, the accent text and glyphs and the accent bar on its leading
  // edge (`::before`). An entry whose route is still committing (`aria-busy="true"`) holds the hover wash and nothing
  // else. The glyph's state sits AFTER its descendant variant (`[&_svg]:data-[state=active]:`): Tailwind 3 applies
  // stacked variants right to left, so the state written first would be looked for on the svg itself.
  rail: [
    'relative isolate flex w-full items-center justify-start gap-[var(--spacing-system-s)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] text-left',
    'bg-transparent text-ods-text-primary text-h4 [&_svg]:fill-ods-text-secondary',
    "after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:bg-ods-bg-hover after:opacity-0 after:transition-opacity after:duration-150 after:content-['']",
    "before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:content-['']",
    'hover:after:opacity-100 aria-busy:after:opacity-100',
    'data-[state=active]:bg-ods-open-yellow-light data-[state=active]:text-ods-accent [&_svg]:data-[state=active]:fill-ods-accent data-[state=active]:before:bg-ods-accent data-[state=active]:after:opacity-0',
    'disabled:cursor-not-allowed disabled:text-ods-text-secondary disabled:opacity-50 disabled:after:opacity-0',
    KIND_FOCUS_INSET,
    '[&_svg]:shrink-0',
  ].join(' '),
  // A tab of a tab strip or a tab list: secondary until it is the open one. A strip that marks its open and hovered
  // tab with the accent fade (the admin strip) says so on each tab with `data-emphasis="fade"`. ODS colour vars hold
  // hex values, so a Tailwind alpha modifier would produce no CSS; color-mix() derives the 10% stop from the token.
  tab: [
    'group relative flex shrink-0 items-center justify-center gap-[var(--spacing-system-xxs)] p-[var(--spacing-system-m)]',
    'bg-transparent text-ods-text-secondary text-h4 transition-colors duration-200',
    'hover:text-ods-text-primary data-[state=active]:text-ods-text-primary',
    'data-[emphasis=fade]:data-[state=active]:bg-gradient-to-b data-[emphasis=fade]:data-[state=active]:from-transparent data-[emphasis=fade]:data-[state=active]:to-[color-mix(in_srgb,var(--color-accent-primary)_10%,transparent)]',
    'data-[emphasis=fade]:hover:bg-gradient-to-b data-[emphasis=fade]:hover:from-transparent data-[emphasis=fade]:hover:to-[color-mix(in_srgb,var(--color-accent-primary)_10%,transparent)]',
    'disabled:cursor-not-allowed disabled:text-ods-text-disabled',
    KIND_FOCUS_INSET,
    '[&_svg]:shrink-0',
  ].join(' '),
  // A segment of a segmented control (`TabSelector`): the label on the strip, a hover fill, and the selected segment
  // (`data-state="active"`) filled with the raised surface; `data-tone="accent"` fills it with the accent instead. A
  // disabled selected segment keeps the raised surface with secondary text.
  segment: [
    'flex items-center justify-center gap-[var(--spacing-system-xs)] whitespace-nowrap rounded-xs p-[var(--spacing-system-xsf)]',
    'bg-transparent text-ods-text-primary text-h4 transition-colors duration-200',
    'hover:bg-ods-bg-hover',
    'data-[state=active]:cursor-default data-[state=active]:bg-ods-bg-surface data-[state=active]:text-ods-text-primary data-[state=active]:hover:bg-ods-bg-surface',
    'data-[tone=accent]:data-[state=active]:bg-ods-accent data-[tone=accent]:data-[state=active]:text-ods-text-on-accent data-[tone=accent]:data-[state=active]:hover:bg-ods-accent',
    'disabled:cursor-not-allowed disabled:bg-transparent disabled:text-ods-text-secondary disabled:hover:bg-transparent',
    'disabled:data-[state=active]:bg-ods-bg-surface disabled:data-[state=active]:text-ods-text-secondary disabled:data-[state=active]:hover:bg-ods-bg-surface',
    'disabled:data-[tone=accent]:data-[state=active]:bg-ods-bg-surface disabled:data-[tone=accent]:data-[state=active]:text-ods-text-secondary disabled:data-[tone=accent]:data-[state=active]:hover:bg-ods-bg-surface',
    KIND_FOCUS_INSET,
    '[&_svg]:shrink-0',
  ].join(' '),
  // A choice drawn as a pill (a filter, a quick question, an answer option): bordered, the accent when picked.
  chip: [
    'inline-flex h-8 items-center gap-[var(--spacing-system-xxs)] rounded-full border px-[var(--spacing-system-sf)]',
    'border-ods-border bg-ods-card text-ods-text-primary text-h6 transition-colors duration-200',
    'hover:border-ods-border-hover hover:bg-ods-bg-hover',
    'aria-pressed:border-ods-accent data-[state=active]:border-ods-accent',
    // `data-tone="accent"`: a pill that links somewhere takes the accent border on hover (a vendor pill).
    'data-[tone=accent]:hover:border-ods-accent',
    'disabled:cursor-not-allowed disabled:text-ods-text-disabled disabled:hover:bg-ods-card',
    KIND_FOCUS,
    '[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
  ].join(' '),
  // A whole card or tile that is one click target (a card's hit area, a media tile, a summary that expands): the
  // content is the look; the button gives it the click, the keyboard and the focus ring.
  card: ['relative block w-full rounded-md text-left text-ods-text-primary', KIND_FOCUS].join(' '),
  // A cell of a bar (a header's or a chat's top bar) or of a card row: the row's full height, an icon or a short
  // label, secondary until hovered. The current cell (`data-state="active"`: the header's open section) takes the
  // pressed surface and the primary text. Full height is `self-stretch` + `min-h-full`, never `h-full`: a set
  // `height: 100%` turns off `align-self: stretch`, so in a row with no fixed height (a chat entity card) the cell
  // fell to the row's top with a divider only as tall as its icon. `min-h-full` keeps a bar's height in a parent
  // that is not a flex row.
  cell: [
    'flex min-h-full shrink-0 items-center justify-center self-stretch gap-[var(--spacing-system-xsf)] px-[var(--spacing-system-m)]',
    'bg-transparent text-ods-text-secondary text-h4 transition-colors duration-200',
    'hover:bg-ods-bg-hover hover:text-ods-text-primary aria-expanded:text-ods-text-primary',
    'data-[state=active]:bg-ods-bg-active data-[state=active]:text-ods-text-primary',
    KIND_FOCUS_INSET,
    '[&_svg]:h-6 [&_svg]:w-6 [&_svg]:shrink-0',
  ].join(' '),
  // A round step control: the previous / next arrow of a carousel's controls row and of a presentation's navbar (the
  // company-hub deck's prev / next, pause and fullscreen). 36px, the card surface with a border, the accent border and
  // glyph on hover, faded when disabled (a carousel at either end of its track). Arrows go through `StepArrowButton`.
  stepper: [
    'grid h-9 w-9 shrink-0 place-items-center rounded-full border-[1.5px] border-ods-border',
    'bg-ods-card text-ods-text-primary transition-colors duration-150',
    'hover:border-ods-accent hover:text-ods-accent',
    'disabled:cursor-default disabled:text-ods-text-secondary disabled:opacity-50 disabled:hover:border-ods-border disabled:hover:text-ods-text-secondary',
    KIND_FOCUS,
    '[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
  ].join(' '),
} as const;

export type ButtonKind = keyof typeof BUTTON_KIND_CLASS;
