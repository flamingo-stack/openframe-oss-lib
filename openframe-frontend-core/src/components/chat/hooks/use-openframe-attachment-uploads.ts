'use client';

/**
 * The OpenFrame (Mingo, Fae) composer's staged files, from the pick to "ready to send": the client's checks, the upload
 * URL from the host, the PUT with progress, then the server's status until the file is ready, blocked or failed.
 * Its `items` feed the composer's tray (`OpenFrameComposerAttachments`) as they are.
 *
 * `scanning` covers everything after the bytes are up and before the server says `ready`: the type and size checks and,
 * once it exists, the malware scan. The host's `uploader` talks to its backend; this hook never adds a credential.
 *
 * This hook is the React glue: the transitions are pure functions (`openframe-attachment-tray`), the uploads and their
 * queue live in `openframe-attachment-upload`, the status reads in `useOpenFrameAttachmentStatusPoll`.
 */

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isOpenFrameImageType,
  type OpenFrameAttachmentErrorCode,
  type OpenFrameAttachmentItem,
  type OpenFrameAttachmentProfile,
} from '../../../chat-protocol/attachment-profiles';
import type {
  OpenFrameAttachmentServerStatus,
  OpenFrameAttachmentUploader,
} from '../../../chat-protocol/attachment-uploader';
import { randomId } from '../../../utils/random-id';
import {
  applyOpenFrameServerStatus,
  failOpenFrameItem,
  isFinalOpenFrameStatus,
  isOpenFrameTrayPending,
  type OpenFrameReadyAttachment,
  type OpenFrameTrayEntry,
  openFrameReadyAttachments,
  openFrameStagedCount,
  openFrameWaitingFiles,
  patchOpenFrameItem,
  stageOpenFrameChecks,
} from '../utils/openframe-attachment-tray';
import { OpenFrameUploadQueue, uploadOpenFrameAttachment } from '../utils/openframe-attachment-upload';
import { validateOpenFrameAttachments } from '../utils/openframe-attachment-validation';
import { useOpenFrameAttachmentStatusPoll } from './use-openframe-attachment-status-poll';

/** How often the server is asked about the files being checked. */
const DEFAULT_STATUS_POLL_MS = 1500;
/** How long a file may stay unchecked before it is shown as failed. */
const DEFAULT_STATUS_MAX_WAIT_MS = 2 * 60 * 1000;
/** Files uploading at once; the rest wait their turn (still shown as uploading at 0%). */
const CONCURRENT_UPLOADS = 3;

export interface UseOpenFrameAttachmentUploadsOptions {
  profile: OpenFrameAttachmentProfile;
  /** The host's backend calls: the upload URL and the status. */
  uploader: OpenFrameAttachmentUploader;
  /** Files the chat already holds (sent before), for the chat limit. */
  chatFileCount: number;
  /** Milliseconds between status reads. Default 1.5 s. */
  statusPollMs?: number;
  /** Milliseconds a file may wait for `ready` before it fails. Default 2 minutes. */
  statusMaxWaitMs?: number;
}

export interface OpenFrameAttachmentUploads {
  /** The tray, in pick order. */
  items: readonly OpenFrameAttachmentItem[];
  /** Files picked, dropped or pasted: checked, then uploaded. Calls run one after another, so limits hold across them. */
  addFiles: (files: File[]) => void;
  /** Cancel an upload, remove a ready file or dismiss a refused one. */
  remove: (id: string) => void;
  /** The ready files, in tray order. */
  ready: readonly OpenFrameReadyAttachment[];
  /** Whether a file is still uploading or being checked (Send waits for it). */
  pending: boolean;
  /**
   * The message went out: hands back the ready files and empties the tray (refused files are dropped, uploads still
   * running are cancelled). The ready files' local pictures stay valid until the composer unmounts, so an optimistic
   * message can keep drawing them.
   */
  takeForSend: () => OpenFrameReadyAttachment[];
  /** Empty the tray and cancel everything (a new chat, a switched conversation). */
  clear: () => void;
}

interface View {
  items: readonly OpenFrameAttachmentItem[];
  ready: readonly OpenFrameReadyAttachment[];
}

const EMPTY_VIEW: View = { items: [], ready: [] };

/** Runs the uploads, a few at once; the line is dropped on unmount. A ref, not state: nothing renders from it. */
function useUploadQueue(): RefObject<OpenFrameUploadQueue> {
  const queue = useRef(new OpenFrameUploadQueue(CONCURRENT_UPLOADS));
  useEffect(() => {
    const line = queue.current;
    return () => line.clear();
  }, []);
  return queue;
}

interface ImagePreviews {
  /** A local picture of an accepted image; nothing for other types. */
  make: (file: File, mediaType: string) => string | undefined;
  revoke: (url: string | undefined) => void;
}

/** Local pictures of picked images. All are revoked on unmount, not on send: a sent message may still be drawing one. */
function useImagePreviews(): ImagePreviews {
  const urls = useRef(new Set<string>());
  const make = useCallback((file: File, mediaType: string) => {
    if (!isOpenFrameImageType(mediaType) || typeof URL.createObjectURL !== 'function') return undefined;
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    return url;
  }, []);
  const revoke = useCallback((url: string | undefined) => {
    if (url && urls.current.delete(url)) URL.revokeObjectURL(url);
  }, []);
  useEffect(() => {
    const all = urls.current;
    return () => {
      for (const url of all) URL.revokeObjectURL(url);
      all.clear();
    };
  }, []);
  return useMemo(() => ({ make, revoke }), [make, revoke]);
}

type TrayChange = (prev: readonly OpenFrameAttachmentItem[]) => readonly OpenFrameAttachmentItem[];

export function useOpenFrameAttachmentUploads({
  profile,
  uploader,
  chatFileCount,
  statusPollMs = DEFAULT_STATUS_POLL_MS,
  statusMaxWaitMs = DEFAULT_STATUS_MAX_WAIT_MS,
}: UseOpenFrameAttachmentUploadsOptions): OpenFrameAttachmentUploads {
  const [view, setView] = useState<View>(EMPTY_VIEW);
  // The tray as of the last change, read synchronously by the async steps (React state lags a commit behind).
  const itemsRef = useRef<readonly OpenFrameAttachmentItem[]>([]);
  const entries = useRef(new Map<string, OpenFrameTrayEntry>());
  const intake = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(true);
  // The latest options, for the async steps started under older ones.
  const latest = useRef({ profile, uploader, chatFileCount });
  useEffect(() => {
    latest.current = { profile, uploader, chatFileCount };
  });

  /** Apply a change to the tray. Computed outside React's updater so it runs once, also under StrictMode. */
  const commit = useCallback((change: TrayChange) => {
    const next = change(itemsRef.current);
    if (!mounted.current || next === itemsRef.current) return;
    itemsRef.current = next;
    setView({ items: next, ready: openFrameReadyAttachments(next, entries.current) });
  }, []);

  /** Show a file as refused and stop waiting on it. */
  const fail = useCallback(
    (id: string, error: OpenFrameAttachmentErrorCode) => {
      const entry = entries.current.get(id);
      if (entry) entry.uploadedAt = undefined;
      commit(prev => failOpenFrameItem(prev, id, error));
    },
    [commit],
  );

  const applyStatus = useCallback(
    (id: string, status: OpenFrameAttachmentServerStatus) => {
      const entry = entries.current.get(id);
      if (!entry) return;
      if (isFinalOpenFrameStatus(status)) entry.uploadedAt = undefined;
      commit(prev => applyOpenFrameServerStatus(prev, id, status));
    },
    [commit],
  );

  const waiting = useCallback(() => openFrameWaitingFiles(entries.current), []);
  const { schedule: schedulePoll, cancelRead } = useOpenFrameAttachmentStatusPoll({
    waiting,
    uploader,
    onStatus: applyStatus,
    onFail: fail,
    pollMs: statusPollMs,
    maxWaitMs: statusMaxWaitMs,
  });

  const upload = useCallback(
    async (id: string) => {
      const entry = entries.current.get(id);
      if (!entry?.mediaType) return;
      const controller = new AbortController();
      entry.controller = controller;
      try {
        await uploadOpenFrameAttachment(entry.file, entry.mediaType, latest.current.uploader, controller.signal, {
          onProgress: progress => commit(prev => patchOpenFrameItem(prev, id, { progress })),
          onUploaded: attachmentId => {
            entry.attachmentId = attachmentId;
            entry.uploadedAt = Date.now();
            commit(prev => patchOpenFrameItem(prev, id, { state: 'scanning', progress: undefined }));
            schedulePoll();
          },
          onFailed: error => fail(id, error),
        });
      } finally {
        if (entry.controller === controller) entry.controller = undefined;
      }
    },
    [commit, fail, schedulePoll],
  );
  const queue = useUploadQueue();
  const previews = useImagePreviews();

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const run = async () => {
        if (!mounted.current) return;
        const { profile: currentProfile, chatFileCount: sent } = latest.current;
        const staged = openFrameStagedCount(itemsRef.current);
        const counts = { messageFileCount: staged, chatFileCount: sent + staged };
        const checks = await validateOpenFrameAttachments(files, currentProfile, counts);
        if (!mounted.current) return;
        const pick = stageOpenFrameChecks(checks, randomId, previews.make);
        for (const [id, entry] of pick.entries) entries.current.set(id, entry);
        commit(prev => [...prev, ...pick.additions]);
        for (const id of pick.queued) queue.current.add(id, () => upload(id));
      };
      // One call after another, so the second pick counts the first one's files. A check that throws must not stop
      // the picks after it.
      intake.current = intake.current.then(run).catch(() => undefined);
    },
    [commit, previews, queue, upload],
  );

  /** Forget a file: cancel its upload, take it out of the queue and the status reads. */
  const drop = useCallback(
    (id: string) => {
      entries.current.get(id)?.controller?.abort();
      entries.current.delete(id);
      queue.current.remove(id);
    },
    [queue],
  );

  const remove = useCallback(
    (id: string) => {
      const thumbnailUrl = itemsRef.current.find(candidate => candidate.id === id)?.thumbnailUrl;
      drop(id);
      previews.revoke(thumbnailUrl);
      commit(prev => prev.filter(candidate => candidate.id !== id));
    },
    [commit, drop, previews],
  );

  const clear = useCallback(() => {
    for (const id of [...entries.current.keys()]) drop(id);
    cancelRead(); // nothing waits any more: a status read in flight is moot
    commit(prev => (prev.length > 0 ? [] : prev)); // an empty tray stays the same array, so React skips the render
  }, [cancelRead, commit, drop]);

  const takeForSend = useCallback(() => {
    const taken = openFrameReadyAttachments(itemsRef.current, entries.current);
    clear();
    return taken;
  }, [clear]);

  useEffect(() => {
    mounted.current = true;
    const all = entries.current;
    return () => {
      mounted.current = false;
      for (const entry of all.values()) entry.controller?.abort();
      all.clear();
    };
  }, []);

  const { items, ready } = view;
  return { items, addFiles, remove, ready, pending: isOpenFrameTrayPending(items), takeForSend, clear };
}
