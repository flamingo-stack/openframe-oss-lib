'use client';

import { DOWNLOADS_API_PATH, type AppDownload, type DownloadsPublic } from '../types/downloads';
import { desktopOsOf } from '../utils/visitor-os';
import { createSharedRequest, type SharedRequestState } from './shared-request';
import { useVisitorOs } from './ui/use-visitor-os';

/** The server's answer (null until it lands), and whether it is still being asked for. */
export type DownloadsState = SharedRequestState<DownloadsPublic>;

/** Every download button on a page asks the same question, so they share ONE request and one answer. */
const downloads = createSharedRequest<DownloadsPublic>();

/** Test seam: forget every answer. */
export function resetDownloadsStore(): void {
  downloads.reset();
}

export interface UseDownloadsOptions {
  /** GET endpoint for the public projection. Default `DOWNLOADS_API_PATH`; embedders pass their proxy path. */
  endpoint?: string;
  /** The server's copy (a host that read it during SSR): no request is made. */
  initialData?: DownloadsPublic;
  /** False: nothing is requested (a host that does not offer the desktop app). Default true. */
  enabled?: boolean;
}

/**
 * What the OpenFrame desktop app is installed from, read FROM THE SERVER
 * (`GET /api/downloads`). The links and package names live in the server's
 * environment; no client holds a copy of its own. Every caller on a page shares
 * one request.
 */
export function useDownloads({ endpoint = DOWNLOADS_API_PATH, initialData, enabled = true }: UseDownloadsOptions = {}) {
  return downloads.useSharedRequest({ endpoint, initialData, enabled });
}

export interface VisitorDesktopDownload {
  /** False until the visitor's system AND the server's list are both known. */
  known: boolean;
  /** This visitor's installer (the first one for their system); null when nothing installs on it. */
  download: AppDownload | null;
}

/**
 * The installer a download button offers THIS visitor: the server's first
 * installer for the system they are on. `enabled: false` asks for nothing.
 */
export function useVisitorDesktopDownload(options: UseDownloadsOptions = {}): VisitorDesktopDownload {
  const enabled = options.enabled ?? true;
  const visitor = useVisitorOs();
  const { data, error } = useDownloads(options);
  if (!enabled || !visitor.known || (!data && !error)) return { known: false, download: null };
  const os = desktopOsOf(visitor.os);
  const download = data?.desktop.find(row => row.kind === 'binary' && row.url && row.os === os) ?? null;
  return { known: true, download };
}
