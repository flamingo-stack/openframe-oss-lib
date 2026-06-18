'use client'

/**
 * Context-item types for the chat composer's entity-context picker
 * (Figma node 31:28708 — the "Assign Item" / `@`-mention flow).
 *
 * The library owns the PICKER UI (the two-level dropdown: entity-type list →
 * searchable multi-select) and the selected-item chips; the HOST owns all data
 * (each entity type is fetched from its own REST/GraphQL source). The host
 * wires a `ChatContextPickerConfig` into `<EmbeddableChat contextPicker={…}>`;
 * the composer threads the user's selection back through
 * `sendMessage(text, { contextItems })` and renders the chips on the sent
 * user bubble.
 *
 * Nothing here is transport-specific — the same config drives Guide and Mingo
 * modes. The picker is inert unless `contextPicker` is supplied.
 */

import type * as React from 'react'

/**
 * A selectable entity TYPE shown in the first-level picker list
 * (Device, Script, Ticket, …). `type` is the backend discriminator the host
 * sends in the message payload (e.g. `'DEVICE'`, `'SCRIPT'`); `label` is the
 * human row title; `icon` is host-supplied (the lib stays free of
 * app-specific entity iconography).
 */
export interface ChatContextEntityType {
  /** Backend discriminator, echoed verbatim onto every `ChatContextItem.type`
   *  produced for this entity (e.g. `'DEVICE'`). */
  type: string
  /** Display label for the type row, e.g. `'Device'`. */
  label: string
  /** Optional icon element rendered at the row lead (host-supplied). */
  icon?: React.ReactNode
}

/**
 * A concrete selected/searchable context item (one device, one script, …).
 * The shape the host feeds back into `ContextItemsList` and the shape echoed
 * back on send via `UnifiedSendMessageOptions.contextItems`.
 */
export interface ChatContextItem {
  /** Type discriminator — matches a `ChatContextEntityType.type`. */
  type: string
  /** Stable backend id, sent in the payload. */
  id: string
  /** Primary display label (chip + list row title), e.g. `'ELK-PROD-07'`. */
  label: string
  /** Optional secondary line in the list row (email, path, status, …). */
  description?: string
}

/**
 * Arguments the picker passes to `ChatContextPickerConfig.renderItems` for the
 * active entity type. The HOST renders the items list for `type`, fetching with
 * its own hooks (TanStack `useSuspenseInfiniteQuery` / react-relay) and feeding
 * the lib's `<ContextItemsList>`. The picker wraps the result in `<Suspense>`
 * (skeleton fallback) + an error boundary, so host components may suspend.
 */
export interface ContextItemsRenderArgs {
  /** Active entity type discriminator (e.g. `'DEVICE'`). */
  type: string
  /** Debounced search text from the picker's search field (`''` = unfiltered). */
  query: string
  /** Selected item keys (`${type}:${id}`) — drives the ✓ state. */
  selectedKeys: Set<string>
  /** Toggle an item in/out of the selection. */
  onToggle: (item: ChatContextItem) => void
  /** True when the selection cap is reached (non-selected rows are disabled). */
  atLimit: boolean
}

/**
 * Host-provided configuration that turns the composer's context-picker on.
 * When present, the composer renders the `+` trigger, the `@`-mention flow, the
 * picker dropdown, and the selected-item chip strip, and forwards the selection
 * on send.
 *
 * The lib owns the dropdown SHELL (root menu, entity-type list, search field,
 * Back nav, Suspense/skeleton/error chrome); the host owns DATA via
 * `renderItems` (per-type hook component → `<ContextItemsList>`).
 */
export interface ChatContextPickerConfig {
  /** Entity types shown in the first-level list, in display order. */
  entityTypes: ChatContextEntityType[]
  /**
   * Render the items list for the active type. The host fetches with its own
   * hooks and returns a `<ContextItemsList>` (or any node). Called inside the
   * picker's `<Suspense>` + error boundary, so it may suspend on initial load.
   */
  renderItems: (args: ContextItemsRenderArgs) => React.ReactNode
  /** Max selectable items. Defaults to 10. */
  maxItems?: number
  /** Optional "Upload File" entry in the `+` menu. When omitted, the menu
   *  collapses to the single "Assign Item" action (or, if attachments are
   *  also off, the `+` button opens the picker directly). */
  onUploadFile?: () => void
}
