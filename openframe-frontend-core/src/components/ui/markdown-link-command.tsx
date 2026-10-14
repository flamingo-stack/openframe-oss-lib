'use client';

import type { ICommand, TextAreaTextApi, TextRange } from '@uiw/react-md-editor';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import {
  type AuthoredLinkRel,
  findMarkdownLinkAt,
  formatMarkdownLink,
  type MarkdownLinkFields,
} from '../../utils/markdown-link';
import { Button } from './button';
import { Input } from './input';
import { ModalV2, ModalV2Footer, ModalV2Header, ModalV2Title } from './modal-v2';
import { TabSelector } from './tab-selector';

type LinkRelChoice = 'follow' | AuthoredLinkRel;

/** What each choice tells search engines, in Google's own terms (Search Central, "Qualify your outbound links"). */
const LINK_REL_CHOICES: { id: LinkRelChoice; label: string; hint: string }[] = [
  { id: 'follow', label: 'Follow', hint: 'Search engines follow this link. This is the default.' },
  {
    id: 'nofollow',
    label: 'Nofollow',
    hint: 'Search engines are asked not to follow this link (rel="nofollow").',
  },
  {
    id: 'sponsored',
    label: 'Sponsored',
    hint: 'For ads, paid placements and sponsorships (rel="sponsored").',
  },
  { id: 'ugc', label: 'UGC', hint: 'For links in content written by users, such as comments (rel="ugc").' },
];

const LINK_REL_ITEMS = LINK_REL_CHOICES.map(({ id, label }) => ({ id, label }));

/** The choice a link's `rel` shows: the most specific value it carries (sponsored, then ugc, then nofollow). */
function choiceOf(rel: readonly AuthoredLinkRel[]): LinkRelChoice {
  if (rel.includes('sponsored')) return 'sponsored';
  if (rel.includes('ugc')) return 'ugc';
  if (rel.includes('nofollow')) return 'nofollow';
  return 'follow';
}

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
 * The link dialog of the markdown editors: the link's text, its address, and what it tells search
 * engines: Follow (the default), Nofollow, Sponsored or UGC. Any choice but Follow writes the link
 * as `<a rel="…">`. A link that carries several values (`rel="ugc nofollow"`) keeps them all until
 * the choice is changed.
 */
export function MarkdownLinkDialog({ isOpen, initial, editing, onSubmit, onRemove, onClose }: MarkdownLinkDialogProps) {
  const formId = useId();
  const [text, setText] = useState(initial.text);
  const [url, setUrl] = useState(initial.url);
  const [rel, setRel] = useState(initial.rel);

  // Re-seed while rendering when the dialog opens on another link (the modal stays mounted).
  const [seededWith, setSeededWith] = useState({ isOpen, initial });
  if (seededWith.isOpen !== isOpen || seededWith.initial !== initial) {
    setSeededWith({ isOpen, initial });
    if (isOpen) {
      setText(initial.text);
      setUrl(initial.url);
      setRel(initial.rel);
    }
  }

  const choice = choiceOf(rel);
  const trimmedUrl = url.trim();
  const submit = () => {
    if (!trimmedUrl) return;
    onSubmit({ text: text.trim(), url: trimmedUrl, rel });
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
            value={choice}
            onValueChange={value => {
              const next = LINK_REL_CHOICES.find(option => option.id === value)?.id ?? 'follow';
              setRel(next === 'follow' ? [] : [next]);
            }}
            items={LINK_REL_ITEMS}
            variant="secondary"
          />
          <p className="text-ods-text-secondary text-h6">
            {LINK_REL_CHOICES.find(option => option.id === choice)?.hint}
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

const EMPTY_LINK: MarkdownLinkFields = { text: '', url: '', rel: [] };

const LOOKS_LIKE_URL = /^(?:https?:\/\/|www\.|mailto:|\/|#)\S*$/i;

function initialFieldsFromSelection(selectedText: string): MarkdownLinkFields {
  const selected = selectedText.trim();
  return LOOKS_LIKE_URL.test(selected) ? { text: '', url: selected, rel: [] } : { text: selected, url: '', rel: [] };
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
                  initial: { text: existing.text, url: existing.url, rel: existing.rel },
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
