'use client';

/**
 * How files get into an OpenFrame composer: the hidden file input the lib owns (opened by Mingo's "Upload File" or
 * Fae's attach button) and a drop zone over the chat or the composer. Both hand plain `File[]` to the host, which
 * checks them (`validateOpenFrameAttachments`) and stages them.
 */

import { type DragEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type OpenFrameAttachmentProfile, openFrameAcceptAttribute } from '../../../chat-protocol/attachment-profiles';

/** The picker: render `input` once, call `open()` from a button or a menu row. */
export interface OpenFrameFilePicker {
  open: () => void;
  input: ReactNode;
}

/**
 * The lib's hidden `<input type="file">` for a profile. `accept` comes from the profile, so the system dialog offers
 * the allowed types first (the checks still run on whatever is picked). The value is reset after each pick, so the same
 * file can be picked twice in a row.
 */
export function useOpenFrameFilePicker(
  profile: OpenFrameAttachmentProfile | undefined,
  onFiles: ((files: File[]) => void) | undefined,
): OpenFrameFilePicker {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onFilesRef = useRef(onFiles);
  useEffect(() => {
    onFilesRef.current = onFiles;
  });
  const accept = useMemo(() => (profile ? openFrameAcceptAttribute(profile) : ''), [profile]);
  const open = useCallback(() => inputRef.current?.click(), []);
  const input = profile ? (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={accept}
      hidden
      data-testid="openframe-attachment-input"
      onChange={e => {
        const field = e.currentTarget;
        const picked = field.files ? Array.from(field.files) : [];
        field.value = '';
        if (picked.length > 0) onFilesRef.current?.(picked);
      }}
    />
  ) : null;
  return { open, input };
}

/** The drag handlers to spread on the zone's element, and whether files are over it now. */
export interface OpenFrameDropZone {
  dragging: boolean;
  handlers: {
    onDragEnter?: (e: DragEvent<HTMLElement>) => void;
    onDragOver?: (e: DragEvent<HTMLElement>) => void;
    onDragLeave?: (e: DragEvent<HTMLElement>) => void;
    onDrop?: (e: DragEvent<HTMLElement>) => void;
  };
}

/** Whether a drag carries files (not text or a link dragged from the page). */
function carriesFiles(e: DragEvent<HTMLElement>): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

/**
 * A drop zone. Disabled (no `onFiles`), it hands back no handlers at all, so the element it is spread on renders and
 * behaves exactly as without it. The enter/leave depth counter keeps the overlay up while the pointer crosses children.
 */
export function useOpenFrameDropZone(onFiles: ((files: File[]) => void) | undefined): OpenFrameDropZone {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const enabled = !!onFiles;
  const onFilesRef = useRef(onFiles);
  useEffect(() => {
    onFilesRef.current = onFiles;
  });

  const handlers = useMemo<OpenFrameDropZone['handlers']>(() => {
    if (!enabled) return {};
    return {
      onDragEnter: e => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      },
      onDragOver: e => {
        if (!carriesFiles(e)) return;
        // Without this the browser opens the file instead of dropping it here.
        e.preventDefault();
        const { dataTransfer } = e;
        dataTransfer.dropEffect = 'copy';
      },
      onDragLeave: e => {
        if (!carriesFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      },
      onDrop: e => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        // A zone inside another (the composer inside the chat) takes the drop once.
        e.stopPropagation();
        depth.current = 0;
        setDragging(false);
        const dropped = Array.from(e.dataTransfer.files ?? []);
        if (dropped.length > 0) onFilesRef.current?.(dropped);
      },
    };
  }, [enabled]);

  return { dragging: enabled && dragging, handlers };
}
