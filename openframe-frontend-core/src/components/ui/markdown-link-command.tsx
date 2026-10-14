'use client';

import type { ICommand, TextAreaTextApi, TextRange } from '@uiw/react-md-editor';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import {
  findMarkdownLinkAt,
  formatMarkdownLink,
  type MarkdownLinkFields,
} from '../../utils/markdown-link';
import { Button } from './button';
import { Input } from './input';
import { ModalV2, ModalV2Footer, ModalV2Header, ModalV2Title } from './modal-v2';
import { TabSelector } from './tab-selector';

const FOLLOW = 'follow';
const NOFOLLOW = 'nofollow';

const LINK_FOLLOW_ITEMS = [
  { id: FOLLOW, label: 'Follow' },
  { id: NOFOLLOW, label: 'Nofollow' },
];

export interface MarkdownLinkDialogProps {
  isOpen: boolean;
  /** The link being edited, or the selection a new link starts from. */
  initial: MarkdownLinkFields;
  /** True when `initial` is a link already in the text: the dialog then offers to remove it. */
  editing: boolean;
  onSubmit: (link: MarkdownLinkFields) => void;
  /** Replaces the link with its text. */
  onRemove: () => void;
  onClose: () => void;
}

/**
 * The link dialog of the markdown editors: the link's text, its address, and whether search engines
 * follow it. Follow is the default; Nofollow writes the link as `<a rel="nofollow">`.
 */
export function MarkdownLinkDialog({ isOpen, initial, editing, onSubmit, onRemove, onClose }: MarkdownLinkDialogProps) {
  const formId = useId();
  const [text, setText] = useState(initial.text);
  const [url, setUrl] = useState(initial.url);
  const [nofollow, setNofollow] = useState(initial.nofollow);

  // Re-seed while rendering when the dialog opens on another link (the modal stays mounted).
  const [seededWith, setSeededWith] = useState({ isOpen, initial });
  if (seededWith.isOpen !== isOpen || seededWith.initial !== initial) {
    setSeededWith({ isOpen, initial });
    if (isOpen) {
      setText(initial.text);
      setUrl(initial.url);
      setNofollow(initial.nofollow);
    }
  }

  const trimmedUrl = url.trim();
  const submit = () => {
    if (!trimmedUrl) return;
    onSubmit({ text: text.trim(), url: trimmedUrl, nofollow });
  };

  return (
    <ModalV2 isOpen={isOpen} onClose={onClose} className="text-left md:max-w-[560px]">
      <ModalV2Header>
        <ModalV2Title>{editing ? 'Edit link' : 'Add link'}</ModalV2Title>
      </ModalV2Header>

      <form
        id={formId}
        className="flex w-full flex-col gap-[var(--spacing-system-l)]"
        onSubmit={event => {
          event.preventDefault();
          submit();
        }}
      >
        <Input label="Text" value={text} onChange={event => setText(event.target.value)} placeholder="Link text" />
        <Input
          label="URL"
          value={url}
          onChange={event => setUrl(event.target.value)}
          placeholder="https://"
          autoFocus
          inputMode="url"
        />
        <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
          <TabSelector
            label="Search engines"
            value={nofollow ? NOFOLLOW : FOLLOW}
            onValueChange={value => setNofollow(value === NOFOLLOW)}
            items={LINK_FOLLOW_ITEMS}
            variant="secondary"
          />
          <p className="text-ods-text-secondary text-h6">
            {nofollow
              ? 'Search engines are asked not to follow this link (rel="nofollow").'
              : 'Search engines follow this link. This is the default.'}
          </p>
        </div>
      </form>

      <ModalV2Footer>
        {editing ? (
          <Button type="button" variant="outline" onClick={onRemove} className="flex-1">
            Remove link
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        )}
        {/* A submit button of the form (by `form`), so Enter in either field saves the link. */}
        <Button type="submit" form={formId} variant="accent" disabled={!trimmedUrl} className="flex-1">
          {editing ? 'Save' : 'Add link'}
        </Button>
      </ModalV2Footer>
    </ModalV2>
  );
}

interface PendingLink {
  api: TextAreaTextApi;
  range: TextRange;
  initial: MarkdownLinkFields;
  editing: boolean;
}

const EMPTY_LINK: MarkdownLinkFields = { text: '', url: '', nofollow: false };

const LOOKS_LIKE_URL = /^(?:https?:\/\/|www\.|mailto:|\/|#)\S*$/i;

function initialFieldsFromSelection(selectedText: string): MarkdownLinkFields {
  const selected = selectedText.trim();
  return LOOKS_LIKE_URL.test(selected)
    ? { text: '', url: selected, nofollow: false }
    : { text: selected, url: '', nofollow: false };
}

export interface MarkdownLinkCommand {
  /**
   * The editor's toolbar: the vendor's commands with its `link` command replaced by this dialog.
   * `undefined` until the vendor's commands have loaded (the editor then shows its own defaults).
   */
  commands: ICommand[] | undefined;
  /** The dialog. Render it beside the editor. */
  linkDialog: ReactNode;
}

/**
 * The link command every markdown editor uses: the toolbar's link button and Ctrl/Cmd+L open
 * {@link MarkdownLinkDialog} on the link under the caret (markdown or HTML), or on the selection
 * for a new link, and write the result back as one undoable edit.
 */
export function useMarkdownLinkCommand(): MarkdownLinkCommand {
  const [vendorCommands, setVendorCommands] = useState<ICommand[] | undefined>(undefined);
  const [pending, setPending] = useState<PendingLink | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mod = await import('@uiw/react-md-editor');
        if (!cancelled && mod.commands?.getCommands) setVendorCommands(mod.commands.getCommands());
      } catch (error) {
        // Chunk load failure: the editor keeps its own default toolbar.
        console.error('Failed to load markdown editor toolbar commands:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const commands = useMemo(() => {
    if (!vendorCommands) return undefined;
    return vendorCommands.map(command => {
      if (command.name !== 'link') return command;
      const linkCommand: ICommand = {
        name: 'link',
        keyCommand: 'link',
        shortcuts: 'ctrlcmd+l',
        buttonProps: { 'aria-label': 'Add or edit a link (ctrl + l)', title: 'Add or edit a link (ctrl + l)' },
        icon: command.icon,
        execute: (state, api) => {
          const existing = findMarkdownLinkAt(state.text, state.selection.start, state.selection.end);
          setPending(
            existing
              ? {
                  api,
                  range: { start: existing.start, end: existing.end },
                  initial: { text: existing.text, url: existing.url, nofollow: existing.nofollow },
                  editing: true,
                }
              : {
                  api,
                  range: state.selection,
                  initial: initialFieldsFromSelection(state.selectedText),
                  editing: false,
                },
          );
        },
      };
      return linkCommand;
    });
  }, [vendorCommands]);

  // Writes over the link's range as ONE edit through the editor's own text API, so Undo restores it.
  const write = (current: PendingLink, text: string) => {
    setPending(null);
    current.api.setSelectionRange(current.range);
    current.api.replaceSelection(text);
  };

  const linkDialog = (
    <MarkdownLinkDialog
      isOpen={pending !== null}
      initial={pending?.initial ?? EMPTY_LINK}
      editing={pending?.editing ?? false}
      onSubmit={link => {
        if (pending) write(pending, formatMarkdownLink(link));
      }}
      onRemove={() => {
        if (pending) write(pending, pending.initial.text);
      }}
      onClose={() => setPending(null)}
    />
  );

  return { commands, linkDialog };
}
