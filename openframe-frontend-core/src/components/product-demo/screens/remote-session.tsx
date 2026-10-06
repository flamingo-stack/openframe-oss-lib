'use client';

import { useMemo } from 'react';
import { RemoteDesktopChatPanel, RemoteDesktopView } from '../../features/remote-session';
import { useProductDemoCast } from '../cast';
import { buildRemoteSessionFixture } from '../fixtures/remote-session';
import type { ProductScreenViewProps } from '../types';
import { RemoteDesktopPicture } from './remote-desktop-picture';

const noop = () => {};
const keepDraft = async () => false;

/**
 * The product's remote desktop page mid-session: the device header, the remote
 * desktop filling the screen box, the session chat beside it. No "Back": a
 * picture has nowhere to go back to. The narrow rendering hides the chat.
 */
export default function RemoteSessionScreen({ compact = false }: ProductScreenViewProps) {
  const cast = useProductDemoCast();
  const fixture = useMemo(() => buildRemoteSessionFixture(cast), [cast]);
  return (
    <div className="flex h-full flex-col bg-ods-bg">
      {/* The page's header row is gone with "Back": the device bar keeps its distance from the top. */}
      <div className="h-[var(--spacing-system-l)] flex-shrink-0" />
      <div className="min-h-0 flex-1">
        <RemoteDesktopView
          {...fixture.view}
          onEnterFullscreen={noop}
          onExitFullscreen={noop}
          onOpenSettings={noop}
          chatOpen={!compact}
          onToggleChat={noop}
          screen={<RemoteDesktopPicture desktop={fixture.desktop} />}
          chat={
            compact ? null : (
              // The side column needs the room of the wide layout; a narrow frame keeps the screen alone.
              <div className="hidden min-h-0 content-md:flex">
                <RemoteDesktopChatPanel {...fixture.chat} sending={false} onSend={keepDraft} variant="side" />
              </div>
            )
          }
        />
      </div>
    </div>
  );
}
