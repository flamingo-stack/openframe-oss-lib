'use client';

/**
 * The OpenFrame (Mingo, Fae) composer's staged files, from the pick to "ready to send": the client's checks, the upload
 * URL from the host, the PUT with progress, then the server's status until the file is ready, blocked or failed.
 * Its `items` feed the composer's tray (`OpenFrameComposerAttachments`) as they are.
 *
 *   picked → checks → uploading (%) → scanning → ready
 *                 ↘ error (TOO_LARGE, TYPE_NOT_ALLOWED, MESSAGE_LIMIT, CHAT_LIMIT, BLOCKED, UPLOAD_FAILED)
 *
 * `scanning` covers everything after the bytes are up and before the server says `ready`: the type and size checks and,
 * once it exists, the malware scan. The host's `uploader` talks to its backend; this hook never adds a credential.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isOpenFrameImageType,
  type OpenFrameAttachmentErrorCode,
  type OpenFrameAttachmentItem,
  type OpenFrameAttachmentProfile,
} from '../../../chat-protocol/attachment-profiles';
import {
  type OpenFrameAttachmentServerStatus,
  type OpenFrameAttachmentUploader,
  OpenFrameAttachmentUploadError,
} from '../../../chat-protocol/attachment-uploader';
import { putFileWithProgress } from '../../../utils/put-file-with-progress';
import { randomId } from '../../../utils/random-id';
import { validateOpenFrameAttachments } from '../utils/openframe-attachment-validation';

/** How often the server is asked about the files being checked. */
const DEFAULT_STATUS_POLL_MS = 1500;
/** How long a file may stay unchecked before it is shown as failed. */
const DEFAULT_STATUS_MAX_WAIT_MS = 2 * 60 * 1000;
/** Status reads that may fail in a row before the files waiting on them fail. */
const STATUS_FAILURES_ALLOWED = 3;
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

/** A ready file, as the message carries it: the server's id and the tray's view of it. */
export interface OpenFrameReadyAttachment {
  attachmentId: string;
  item: OpenFrameAttachmentItem;
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

/** What the hook keeps per staged file beside its view model. */
interface Entry {
  file: File;
  mediaType?: string;
  attachmentId?: string;
  controller?: AbortController;
  /** When the bytes finished going up: the start of the wait for `ready`. */
  uploadedAt?: number;
}

interface View {
  items: readonly OpenFrameAttachmentItem[];
  ready: readonly OpenFrameReadyAttachment[];
}

const EMPTY_VIEW: View = { items: [], ready: [] };

function errorCodeOf(err: unknown): OpenFrameAttachmentErrorCode {
  return err instanceof OpenFrameAttachmentUploadError ? err.code : 'UPLOAD_FAILED';
}

/** The files whose bytes are up and that wait for the server's `ready`. */
function waitingIdsOf(entries: ReadonlyMap<string, Entry>): string[] {
  return [...entries].filter(([, entry]) => entry.uploadedAt !== undefined && entry.attachmentId).map(([id]) => id);
}

/** The ready files of a tray, with their server ids. */
function readyOf(
  items: readonly OpenFrameAttachmentItem[],
  entries: ReadonlyMap<string, Entry>,
): OpenFrameReadyAttachment[] {
  return items.flatMap(item => {
    const attachmentId = item.state === 'ready' ? entries.get(item.id)?.attachmentId : undefined;
    return attachmentId ? [{ attachmentId, item }] : [];
  });
}

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
  const entries = useRef(new Map<string, Entry>());
  const queue = useRef<string[]>([]);
  const active = useRef(0);
  const intake = useRef<Promise<void>>(Promise.resolve());
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollController = useRef<AbortController | null>(null);
  const statusFailures = useRef(0);
  // Every local picture made, revoked on unmount: a sent message may still be drawing one.
  const objectUrls = useRef(new Set<string>());
  const mounted = useRef(true);

  // The latest options, for the async steps started under older ones.
  const latest = useRef({ profile, uploader, chatFileCount, statusPollMs, statusMaxWaitMs });
  useEffect(() => {
    latest.current = { profile, uploader, chatFileCount, statusPollMs, statusMaxWaitMs };
  });

  /** Apply a change to the tray. Computed outside React's updater so it runs once, also under StrictMode. */
  const commit = useCallback((change: (prev: readonly OpenFrameAttachmentItem[]) => OpenFrameAttachmentItem[]) => {
    if (!mounted.current) return;
    const next = change(itemsRef.current);
    itemsRef.current = next;
    setView({ items: next, ready: readyOf(next, entries.current) });
  }, []);

  const patch = useCallback(
    (id: string, update: Partial<OpenFrameAttachmentItem>) => {
      commit(prev => prev.map(item => (item.id === id ? { ...item, ...update } : item)));
    },
    [commit],
  );

  /** Show a file as refused and stop waiting on it. */
  const fail = useCallback(
    (id: string, error: OpenFrameAttachmentErrorCode) => {
      const entry = entries.current.get(id);
      if (entry) entry.uploadedAt = undefined;
      patch(id, { state: 'error', error, progress: undefined });
    },
    [patch],
  );

  // ── Status polling ────────────────────────────────────────────────────────

  const applyStatus = useCallback(
    (id: string, status: OpenFrameAttachmentServerStatus) => {
      const entry = entries.current.get(id);
      if (!entry) return;
      if (status.state === 'ready') {
        entry.uploadedAt = undefined;
        const current = itemsRef.current.find(item => item.id === id);
        patch(id, {
          state: 'ready',
          progress: undefined,
          tokenEstimate: status.tokenEstimate,
          thumbnailUrl: current?.thumbnailUrl ?? status.thumbnailUrl,
        });
      } else if (status.state === 'blocked' || status.state === 'failed') {
        fail(id, status.state === 'blocked' ? 'BLOCKED' : (status.error ?? 'UPLOAD_FAILED'));
      } else if (status.tokenEstimate !== undefined) {
        patch(id, { tokenEstimate: status.tokenEstimate });
      }
    },
    [fail, patch],
  );

  /** One status read for every waiting file; it books the next one while any file still waits. */
  const poll = useCallback(
    async function pollOnce(): Promise<void> {
      const now = Date.now();
      for (const id of waitingIdsOf(entries.current)) {
        const uploadedAt = entries.current.get(id)?.uploadedAt;
        if (uploadedAt !== undefined && now - uploadedAt > latest.current.statusMaxWaitMs) fail(id, 'UPLOAD_FAILED');
      }
      const asking = waitingIdsOf(entries.current);
      if (asking.length > 0) {
        const byServerId = new Map(asking.map(id => [entries.current.get(id)?.attachmentId ?? '', id]));
        const controller = new AbortController();
        pollController.current = controller;
        try {
          const statuses = await latest.current.uploader.getStatuses([...byServerId.keys()], controller.signal);
          if (controller.signal.aborted) return;
          statusFailures.current = 0;
          for (const status of statuses) {
            const id = byServerId.get(status.attachmentId);
            if (id) applyStatus(id, status);
          }
        } catch {
          if (controller.signal.aborted) return;
          statusFailures.current += 1;
          if (statusFailures.current >= STATUS_FAILURES_ALLOWED) {
            statusFailures.current = 0;
            for (const id of waitingIdsOf(entries.current)) fail(id, 'UPLOAD_FAILED');
          }
        } finally {
          if (pollController.current === controller) pollController.current = null;
        }
      }
      if (mounted.current && pollTimer.current === null && waitingIdsOf(entries.current).length > 0) {
        pollTimer.current = setTimeout(() => {
          pollTimer.current = null;
          void pollOnce();
        }, latest.current.statusPollMs);
      }
    },
    [applyStatus, fail],
  );

  /** Book a status read unless one is booked or running. */
  const schedulePoll = useCallback(() => {
    if (pollTimer.current !== null || pollController.current !== null || !mounted.current) return;
    pollTimer.current = setTimeout(() => {
      pollTimer.current = null;
      void poll();
    }, latest.current.statusPollMs);
  }, [poll]);

  // ── Uploads ───────────────────────────────────────────────────────────────

  const upload = useCallback(
    async (id: string) => {
      const entry = entries.current.get(id);
      if (!entry?.mediaType) return;
      const controller = new AbortController();
      entry.controller = controller;
      const { signal } = controller;
      try {
        const target = await latest.current.uploader.createUpload(
          { name: entry.file.name, mediaType: entry.mediaType, size: entry.file.size },
          signal,
        );
        if (signal.aborted) return;
        entry.attachmentId = target.attachmentId;
        let shown = 0;
        await putFileWithProgress(target.uploadUrl, entry.file, {
          headers: target.uploadHeaders,
          signal,
          onProgress: fraction => {
            // Whole percents only, and never 100 before the answer: a render per progress event is wasted.
            const percent = Math.min(99, Math.floor(fraction * 100));
            if (percent === shown) return;
            shown = percent;
            patch(id, { progress: percent });
          },
        });
        if (signal.aborted) return;
        entry.uploadedAt = Date.now();
        patch(id, { state: 'scanning', progress: undefined });
        schedulePoll();
      } catch (err) {
        if (signal.aborted) return;
        fail(id, errorCodeOf(err));
      } finally {
        entry.controller = undefined;
      }
    },
    [fail, patch, schedulePoll],
  );

  const pump = useCallback(
    function pumpQueue() {
      while (active.current < CONCURRENT_UPLOADS && queue.current.length > 0) {
        const id = queue.current.shift();
        if (!id || !entries.current.has(id)) continue;
        active.current += 1;
        void upload(id).finally(() => {
          active.current -= 1;
          pumpQueue();
        });
      }
    },
    [upload],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const run = async () => {
        if (!mounted.current) return;
        const { profile: currentProfile, chatFileCount: sent } = latest.current;
        const staged = itemsRef.current.filter(item => item.state !== 'error').length;
        const checks = await validateOpenFrameAttachments(files, currentProfile, {
          messageFileCount: staged,
          chatFileCount: sent + staged,
        });
        if (!mounted.current) return;
        const additions: OpenFrameAttachmentItem[] = [];
        for (const check of checks) {
          const id = randomId();
          const { file } = check;
          if (!check.ok) {
            entries.current.set(id, { file });
            additions.push({ id, name: file.name, size: file.size, state: 'error', error: check.error });
            continue;
          }
          let thumbnailUrl: string | undefined;
          if (isOpenFrameImageType(check.mediaType) && typeof URL.createObjectURL === 'function') {
            thumbnailUrl = URL.createObjectURL(file);
            objectUrls.current.add(thumbnailUrl);
          }
          entries.current.set(id, { file, mediaType: check.mediaType });
          queue.current.push(id);
          additions.push({
            id,
            name: file.name,
            size: file.size,
            mediaType: check.mediaType,
            state: 'uploading',
            progress: 0,
            thumbnailUrl,
          });
        }
        commit(prev => [...prev, ...additions]);
        pump();
      };
      // One call after another, so the second pick counts the first one's files. A check that throws must not stop
      // the picks after it.
      intake.current = intake.current.then(run).catch(() => undefined);
    },
    [commit, pump],
  );

  /** Forget a file: cancel its upload, take it out of the queue and the status reads. */
  const drop = useCallback((id: string) => {
    entries.current.get(id)?.controller?.abort();
    entries.current.delete(id);
    queue.current = queue.current.filter(queued => queued !== id);
  }, []);

  const remove = useCallback(
    (id: string) => {
      const item = itemsRef.current.find(candidate => candidate.id === id);
      drop(id);
      if (item?.thumbnailUrl && objectUrls.current.has(item.thumbnailUrl)) {
        URL.revokeObjectURL(item.thumbnailUrl);
        objectUrls.current.delete(item.thumbnailUrl);
      }
      commit(prev => prev.filter(candidate => candidate.id !== id));
    },
    [commit, drop],
  );

  const clear = useCallback(() => {
    for (const id of [...entries.current.keys()]) drop(id);
    // Nothing waits any more: a status read in flight is moot.
    pollController.current?.abort();
    pollController.current = null;
    // Leave the state alone when the tray is already empty, so React skips the render.
    if (itemsRef.current.length > 0) commit(() => []);
  }, [commit, drop]);

  const takeForSend = useCallback(() => {
    const taken = readyOf(itemsRef.current, entries.current);
    clear();
    return taken;
  }, [clear]);

  useEffect(() => {
    mounted.current = true;
    const urls = objectUrls.current;
    const all = entries.current;
    return () => {
      mounted.current = false;
      for (const entry of all.values()) entry.controller?.abort();
      all.clear();
      queue.current = [];
      pollController.current?.abort();
      pollController.current = null;
      if (pollTimer.current !== null) clearTimeout(pollTimer.current);
      pollTimer.current = null;
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const pending = view.items.some(item => item.state === 'uploading' || item.state === 'scanning');

  return { items: view.items, addFiles, remove, ready: view.ready, pending, takeForSend, clear };
}
