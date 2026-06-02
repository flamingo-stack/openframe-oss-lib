'use client'

import * as React from 'react'
import { ChatFooter } from './chat-container'
import { ChatInput } from './chat-input'
import { ChatAttachmentAddButton } from './chat-attachment-bar'
import { ModelDisplay } from './model-display'
import { BoxArchiveIcon } from '../icons-v2-generated'
import type { ChatInputRef, ModelDisplayProps } from './types/component.types'

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
}

/**
 * Chat panel footer (Figma node 7363:205952): the message composer (live
 * `ChatInput` or the read-only archived placeholder) above the model/usage
 * row. No own background — inherits the panel surface so it blends seamlessly.
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
}: ChatComposerProps) {
  return (
    <div
      className="flex-shrink-0 px-[var(--spacing-system-m)] pb-[var(--spacing-system-m)] flex flex-col gap-[var(--spacing-system-xxs)]"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <ChatFooter className="!p-0" fullWidth>
        {archived ? (
          <div className="flex w-full items-center justify-center gap-[var(--spacing-system-xs)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)]">
            <BoxArchiveIcon size={24} className="shrink-0 text-ods-text-secondary" />
            <p className="truncate text-h4 text-ods-text-secondary">
              Unarchive the chat to continue
            </p>
          </div>
        ) : (
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
          />
        )}
      </ChatFooter>

      <div className="flex items-center gap-2 w-full">
        {showAttachmentButton && onAddFiles && (
          // Attachments are Guide-only: the NATS agent backend doesn't accept
          // them, so the add-button is hidden in Mingo mode. Skipping the
          // render entirely (not just the icon) collapses the otherwise-
          // invisible 28px placeholder slot the component leaves for layout.
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
