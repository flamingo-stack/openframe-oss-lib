import type { HTMLAttributes } from 'react';

/**
 * Who is on the other end of a remote session, as the end user's surfaces show
 * it: the organization always, the technician when the backend names one.
 */
export interface RemoteSessionParty {
  organizationName: string;
  organizationLogoUrl?: string | null;
  /** Shown under the organization name; offered as a link only when it is https. */
  organizationSiteUrl?: string | null;
  /** Present for the technician variant of the session block; the organization variant otherwise. */
  technicianName?: string | null;
  technicianAvatarUrl?: string | null;
}

/** The end user's answer to a remote access request. */
export type RemoteAccessDecision = 'APPROVED' | 'DENIED';

export type RemoteSessionChatAuthor = 'technician' | 'user' | 'system';

export interface RemoteSessionChatMessage {
  id: string;
  author: RemoteSessionChatAuthor;
  /** The technician's display name on their rows; the party's technician otherwise. */
  name?: string | null;
  text: string;
  at: Date;
}

/** The terminal dialogs of a session: the end confirm and the two "it is over" notices. */
export type RemoteSessionDialogVariant = 'end-confirm' | 'session-ended' | 'connection-lost';

/** Someone in a live session: the technician running it (the host) or a colleague watching. */
export interface RemoteSessionViewer {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** The technician running the session; listed first and ringed in the accent colour. */
  isHost?: boolean;
  /** The signed-in user, labelled "(you)" in the list. */
  isYou?: boolean;
}

/** Where a remote session's recording is in its lifecycle, as the session list tags it. */
export type RemoteSessionStatus = 'live' | 'processing' | 'failed';

/** Why a recording is kept past its expiry date. */
export type RemoteSessionKeepReason = 'CLIENT_DISPUTE' | 'INTERNAL_REVIEW' | 'LEGAL_OR_COMPLIANCE' | 'OTHER';

/** A moment of the session, placed on the recording by its offset from the start. */
export interface RemoteSessionEvent {
  id: string;
  /** Milliseconds from the start of the recording. */
  offsetMs: number;
  title: string;
  detail?: string | null;
}

/**
 * Pointer handlers a host attaches to the surfaces the user moves the window
 * by (the desktop chat starts a native window drag from them).
 */
export type RemoteSessionDragHandlers = Pick<
  HTMLAttributes<HTMLElement>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp'
>;
