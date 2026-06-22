'use client'

import * as React from 'react'
import { ChatFooter } from './chat-container'
import { ChatInput } from './chat-input'
import { ChatAttachmentAddButton } from './chat-attachment-bar'
import {
  ChatComposerPlusMenu,
  ChatContextChipStrip,
  ChatContextPicker,
} from './chat-context-picker'
import { ModelDisplay } from './model-display'
import { BoxArchiveIcon } from '../icons-v2-generated'
import type { ChatInputRef, ModelDisplayProps } from './types/component.types'
import type {
  ChatContextItem,
  ChatContextPickerConfig,
} from './types/context-item.types'

export interface ChatComposerProps {
  /** Read-only archived chat → render the unarchive placeholder instead of the
   *  input (Figma node 7361:426949). */
  archived?: boolean
  inputRef: React.Ref<ChatInputRef>
  onSend: (text: string) => void
  onStop: () => void
  sending: boolean
  placeholder: string
  autoFocus?: boolean
  slashCommands?: React.ComponentProps<typeof ChatInput>['slashCommands']
  /** Show the (Guide-only) attachment add button to the left of the model row. */
  showAttachmentButton?: boolean
  attachmentsCount?: number
  onAddFiles?: (files: FileList | File[]) => void
  attachmentsDisabled?: boolean
  /** Model + usage row props, forwarded to `<ModelDisplay>`. */
  model: ModelDisplayProps

  // ─── Entity-context picker (Figma 31:28708 / 1:5699) ──────────────────────
  // When `contextPicker` is set the composer renders the `+` "Assign Item"
  // menu, the `@`-mention trigger, the two-level picker, and the selected-item
  // chip strip. All selection STATE is owned by the parent (EmbeddableChat) and
  // flows through these props; this component is presentational.
  /** Host config (entity types + search resolver). Picker is inert when unset. */
  contextPicker?: ChatContextPickerConfig
  /** Currently-selected context items (chips + ✓ state). */
  selectedContextItems?: ChatContextItem[]
  /** Toggle an item in/out of the selection (picker rows). */
  onToggleContextItem?: (item: ChatContextItem) => void
  /** Remove an item (chip ×). */
  onRemoveContextItem?: (item: ChatContextItem) => void
  /** Controlled picker open state. */
  contextPickerOpen?: boolean
  /** Open the picker (the `+` menu's "Assign Item"). */
  onOpenContextPicker?: () => void
  /** Close the picker (Escape / outside-click / pick-complete). */
  onCloseContextPicker?: () => void
  /** Active `@`-mention query (filters the type list); null when inactive. */
  mentionQuery?: string | null
  /** `@`-trigger callback forwarded to the input. */
  onMentionQueryChange?: (query: string | null) => void
  /** Fires on every draft value change — threaded to `ChatInput.onValueChange`
   *  so the host can keep `@type:id` mention tokens in sync with context chips. */
  onValueChange?: (value: string) => void
}

/**
 * Chat panel footer (Figma node 7363:205952): the message composer (live
 * `ChatInput` or the read-only archived placeholder) above the model/usage
 * row. No own background — inherits the panel surface so it blends seamlessly.
 *
 * With `contextPicker` set, the selected-context chip strip sits above the
 * input, the two-level picker popover anchors above the input, and the bottom
 * controls row swaps the bare attachment `+` for the `+` plus-menu.
 */
export function ChatComposer({
  archived = false,
  inputRef,
  onSend,
  onStop,
  sending,
  placeholder,
  autoFocus,
  slashCommands,
  showAttachmentButton = false,
  attachmentsCount = 0,
  onAddFiles,
  attachmentsDisabled = false,
  model,
  contextPicker,
  selectedContextItems,
  onToggleContextItem,
  onRemoveContextItem,
  contextPickerOpen = false,
  onOpenContextPicker,
  onCloseContextPicker,
  mentionQuery = null,
  onMentionQueryChange,
  onValueChange,
}: ChatComposerProps) {
  const contextEnabled = !!contextPicker && !archived
  const selected = selectedContextItems ?? []

  // type → icon lookup so the chips (composer + bubble) lead with their
  // entity-type glyph without the parent threading an extra resolver. Keyed on
  // `entityTypes` (not the whole `contextPicker`) so an inline host config
  // doesn't rebuild the map — and the derived `resolveContextIcon` — every render.
  const entityTypes = contextPicker?.entityTypes
  const iconByType = React.useMemo(() => {
    const map = new Map<string, React.ReactNode>()
    for (const t of entityTypes ?? []) map.set(t.type, t.icon)
    return map
  }, [entityTypes])
  const resolveContextIcon = React.useCallback(
    (item: ChatContextItem) => iconByType.get(item.type),
    [iconByType],
  )

  // The input is identical in both layouts; only `hideBorder` (context mode
  // lets the outer card own the chrome) and the `+` adornment differ.
  const inputNode = (
    <ChatInput
      ref={inputRef}
      onSend={onSend}
      onStop={onStop}
      sending={sending}
      placeholder={placeholder}
      fullWidth
      className="px-0"
      reserveAvatarOffset={false}
      autoFocus={autoFocus}
      slashCommands={slashCommands}
      onMentionQueryChange={contextEnabled ? onMentionQueryChange : undefined}
      onValueChange={contextEnabled ? onValueChange : undefined}
      hideBorder={contextEnabled}
      // `+` lives INSIDE the input (start adornment, Figma 31:28275) and opens
      // the single context dropdown directly. The picker is passed as the
      // button's `dropdown` so it anchors to the `+`, not the input row.
      startIcon={
        contextEnabled ? (
          <ChatComposerPlusMenu
            onToggle={() => (contextPickerOpen ? onCloseContextPicker?.() : onOpenContextPicker?.())}
            open={contextPickerOpen}
            disabled={attachmentsDisabled}
            dropdown={
              contextPicker ? (
                <ChatContextPicker
                  open={contextPickerOpen}
                  config={contextPicker}
                  selectedItems={selected}
                  onToggleItem={(item) => onToggleContextItem?.(item)}
                  onClose={() => onCloseContextPicker?.()}
                  mentionQuery={mentionQuery}
                />
              ) : undefined
            }
          />
        ) : undefined
      }
    />
  )

  return (
    <div
      className="flex-shrink-0 px-[var(--spacing-system-m)] pb-[var(--spacing-system-xxs)] flex flex-col gap-[var(--spacing-system-xxs)]"
      // Tight `xxs` bottom padding (the model/usage row already sits just below
      // the input); `max(…, safe-area-inset)` still clears the iOS home bar.
      style={{
        paddingBottom: 'max(var(--spacing-system-xxs), env(safe-area-inset-bottom))',
      }}
    >
      <div>
        <ChatFooter className="!p-0" fullWidth>
          {archived ? (
            <div className="flex w-full items-center justify-center gap-[var(--spacing-system-xs)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)]">
              <BoxArchiveIcon size={24} className="shrink-0 text-ods-text-secondary" />
              <p className="truncate text-h4 text-ods-text-secondary">
                Unarchive the chat to continue
              </p>
            </div>
          ) : contextEnabled ? (
            // Unified card (Figma 1:6073): a context-chip header strip
            // (`bg-ods-bg`, `border-b`) sits flush above the input; the card
            // owns the border / radius / focus ring. No `overflow-hidden` so the
            // picker popover can float above the input (chips get `rounded-t`).
            // `has-[textarea:focus]` (not `focus-within`) so the accent border
            // reacts ONLY to the composer textarea — not the picker's search
            // input or item buttons, which also live inside this card.
            <div className="rounded-md border border-ods-border bg-ods-card transition-colors has-[textarea:focus]:border-ods-accent">
              {selected.length > 0 && (
                <ChatContextChipStrip
                  items={selected}
                  onRemove={onRemoveContextItem}
                  resolveIcon={resolveContextIcon}
                  disabled={sending}
                  className="rounded-t-md border-b border-ods-border bg-ods-bg p-2"
                />
              )}
              {/* Picker is rendered inside the `+` button (its `dropdown` prop)
                  so it anchors to the button, not this card. */}
              {inputNode}
            </div>
          ) : (
            inputNode
          )}
        </ChatFooter>
      </div>

      <div className="flex items-center gap-2 w-full">
        {/* Legacy (Guide-mode, no context picker) inline attachment `+`. With the
            context picker on, uploads live in the in-input `+` menu instead. */}
        {!contextEnabled && showAttachmentButton && onAddFiles && (
          <ChatAttachmentAddButton
            attachmentsEnabled
            attachmentsCount={attachmentsCount}
            onAddFiles={onAddFiles}
            disabled={attachmentsDisabled}
          />
        )}
        <div className="flex-1 min-w-0">
          <ModelDisplay {...model} />
        </div>
      </div>
    </div>
  )
}
