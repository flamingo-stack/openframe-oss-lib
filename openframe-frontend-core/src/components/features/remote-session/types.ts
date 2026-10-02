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

/**
 * Pointer handlers a host attaches to the surfaces the user moves the window
 * by (the desktop chat starts a native window drag from them).
 */
export type RemoteSessionDragHandlers = Pick<
  HTMLAttributes<HTMLElement>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp'
>;
