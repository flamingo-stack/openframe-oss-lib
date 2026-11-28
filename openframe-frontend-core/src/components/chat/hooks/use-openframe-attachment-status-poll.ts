'use client';

/**
 * The server-status reads behind `useOpenFrameAttachmentUploads`: while any file waits for `ready`, one read every
 * `pollMs` for all of them. A file waiting longer than `maxWaitMs` fails; so do all waiting files after a few failed
 * reads in a row. Internal to the uploads hook.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { OpenFrameAttachmentErrorCode } from '../../../chat-protocol/attachment-profiles';
import type {
  OpenFrameAttachmentServerStatus,
  OpenFrameAttachmentUploader,
} from '../../../chat-protocol/attachment-uploader';
import {
  countOpenFrameStatusFailure,
  type OpenFrameWaitingFile,
  overdueOpenFrameFiles,
} from '../utils/openframe-attachment-tray';

export interface OpenFrameAttachmentStatusPollOptions {
  /** The files waiting now (read before every step, so a removed or failed file drops out at once). */
  waiting: () => OpenFrameWaitingFile[];
  /** The host's backend calls; only `getStatuses` is used here. */
  uploader: OpenFrameAttachmentUploader;
  onStatus: (id: string, status: OpenFrameAttachmentServerStatus) => void;
  /** The file failed while waiting (overdue, or the reads kept failing): always `UPLOAD_FAILED`. */
  onFail: (id: string, error: OpenFrameAttachmentErrorCode) => void;
  pollMs: number;
  maxWaitMs: number;
}

export interface OpenFrameAttachmentStatusPoll {
  /** Book a status read unless one is booked or running. */
  schedule: () => void;
  /** Drop the read in flight and the one booked: nothing waits on them any more. */
  cancelRead: () => void;
}

export function useOpenFrameAttachmentStatusPoll(
  options: OpenFrameAttachmentStatusPollOptions,
): OpenFrameAttachmentStatusPoll {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const failures = useRef(0);
  const mounted = useRef(true);

  /** One read for every waiting file; it books the next one while any file still waits. */
  const read = useCallback(async function readOnce(): Promise<void> {
    const { waiting, onFail, maxWaitMs } = latest.current;
    for (const id of overdueOpenFrameFiles(waiting(), Date.now(), maxWaitMs)) onFail(id, 'UPLOAD_FAILED');
    const asking = waiting();
    if (asking.length > 0) {
      const byServerId = new Map(asking.map(file => [file.attachmentId, file.id]));
      const current = new AbortController();
      controller.current = current;
      try {
        const statuses = await latest.current.uploader.getStatuses([...byServerId.keys()], current.signal);
        if (current.signal.aborted) return;
        failures.current = 0;
        for (const status of statuses) {
          const id = byServerId.get(status.attachmentId);
          if (id) latest.current.onStatus(id, status);
        }
      } catch {
        if (current.signal.aborted) return;
        const counted = countOpenFrameStatusFailure(failures.current);
        failures.current = counted.failures;
        if (counted.failWaiting) {
          for (const file of latest.current.waiting()) latest.current.onFail(file.id, 'UPLOAD_FAILED');
        }
      } finally {
        if (controller.current === current) controller.current = null;
      }
    }
    if (mounted.current && timer.current === null && latest.current.waiting().length > 0) {
      timer.current = setTimeout(() => {
        timer.current = null;
        void readOnce();
      }, latest.current.pollMs);
    }
  }, []);

  const schedule = useCallback(() => {
    if (timer.current !== null || controller.current !== null || !mounted.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      void read();
    }, latest.current.pollMs);
  }, [read]);

  const cancelRead = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      controller.current = null;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);

  return { schedule, cancelRead };
}
