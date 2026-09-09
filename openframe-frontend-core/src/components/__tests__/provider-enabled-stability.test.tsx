/**
 * `enabled` on `TicketLiveProvider` / `TimeTrackerProvider` — the contract that
 * makes a CONDITIONAL mount unnecessary, pinned.
 *
 * A host that writes `enabled ? <Provider>{children}</Provider> : <>{children}</>`
 * changes the element type at that position the moment its flag answers, and React
 * tears down and remounts everything below. In openframe-frontend that wrapper sat
 * around the whole app shell, so every cold load remounted the shell and the page
 * inside it — visibly, as a chat drawer opened by a deep link replaying its open
 * animation.
 *
 * So both providers stay mounted and take the answer as a prop. Two properties have
 * to hold for that to be a real alternative, and both are asserted here per provider:
 *
 *   1. flipping `enabled` does NOT remount the subtree — the children keep their
 *      state and their DOM nodes;
 *   2. `enabled={false}` provides NO context, so consumers behave exactly as they
 *      did when the provider was absent.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Identity resolution is the only thing `TicketLiveProvider` reaches out for while
// enabled. A promise that never settles keeps the test offline AND free of state
// updates landing outside `act` — the provider's stream stays down either way,
// since it waits on a non-anon identity that never arrives.
vi.mock('../../utils/embed-authed-fetch', () => ({
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import { ChatRuntimeContext, type ChatRuntime } from '../../contexts/chat-runtime-context';
import { TimeTrackerProvider, useOptionalTimeTracker } from '../features/time-tracker/time-tracker-context';
import type { TimeTrackerData } from '../features/time-tracker/types';
import { TicketLiveProvider, useOptionalTicketLive } from '../tickets/ticket-live-provider';

let mountCount = 0;

/** Counts its own mounts, holds state across renders, and reports whether the
 *  provider above it supplied a context. */
function Subject({ contextLabel }: { contextLabel: string }) {
  const [seed] = useState(() => `seed-${mountCount}`);
  useEffect(() => {
    mountCount += 1;
  }, []);
  return (
    <div data-testid="subject" data-seed={seed}>
      {contextLabel}
    </div>
  );
}

function TicketLiveSubject() {
  const live = useOptionalTicketLive();
  return <Subject contextLabel={live ? 'context' : 'no-context'} />;
}

function TimeTrackerSubject() {
  const tracker = useOptionalTimeTracker();
  return <Subject contextLabel={tracker ? 'context' : 'no-context'} />;
}

/**
 * `TicketLiveProvider` needs a chat runtime above it EVEN WHEN DISABLED: its
 * identity resolver reads one unconditionally (Rules of Hooks), and only the
 * fetch is gated. Hosts that mount the provider always — which is the whole
 * point of `enabled` — therefore also mount the runtime always.
 */
const runtime: ChatRuntime = {
  endpoints: {
    chatStreamUrl: '/api/docs/chat',
    approvalToolUrl: '/api/chat/agent/confirm-tool',
    commandsUrl: '/api/docs/commands',
    buildListUrl: () => null,
    attachmentUploadUrl: '/api/storage/generate-upload-url',
    attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
    identityUrl: '/api/chat/identity',
  },
  navigation: { mode: 'host' },
};

function withTicketLiveDeps(children: ReactNode) {
  // A fresh query client per render tree; nothing here queries, it is only the
  // `useQueryClient()` the provider calls for its invalidations.
  return (
    <QueryClientProvider client={new QueryClient()}>
      <ChatRuntimeContext.Provider value={runtime}>{children}</ChatRuntimeContext.Provider>
    </QueryClientProvider>
  );
}

/** The minimum `TimeTrackerData` the provider's type demands. */
const trackerData: TimeTrackerData = {
  status: 'ready',
  ticketOptions: [],
  selectedTicketId: null,
  onSelectedTicketChange: () => {},
  notes: '',
  onNotesChange: () => {},
  lastEntries: [],
  onStart: () => {},
  onPause: () => {},
  onResume: () => {},
  onCancel: () => {},
  onSubmit: () => {},
};

beforeEach(() => {
  mountCount = 0;
});

describe.each([
  {
    name: 'TicketLiveProvider',
    tree: (enabled: boolean) =>
      withTicketLiveDeps(
        <TicketLiveProvider enabled={enabled}>
          <TicketLiveSubject />
        </TicketLiveProvider>,
      ),
  },
  {
    name: 'TimeTrackerProvider',
    tree: (enabled: boolean) => (
      <TimeTrackerProvider enabled={enabled} {...trackerData}>
        <TimeTrackerSubject />
      </TimeTrackerProvider>
    ),
  },
])('$name', ({ tree }) => {
  it('does not remount its children when `enabled` flips', () => {
    const { rerender } = render(tree(false));
    const before = screen.getByTestId('subject');
    expect(mountCount).toBe(1);

    rerender(tree(true));

    // Same DOM node, same state, one mount: the subtree was updated, not rebuilt.
    expect(screen.getByTestId('subject')).toBe(before);
    expect(screen.getByTestId('subject').dataset.seed).toBe('seed-0');
    expect(mountCount).toBe(1);

    // And back — a flag that resolves to off must not rebuild the tree either.
    rerender(tree(false));
    expect(screen.getByTestId('subject')).toBe(before);
    expect(mountCount).toBe(1);
  });

  it('provides no context while disabled, and one once enabled', () => {
    const { rerender } = render(tree(false));
    expect(screen.getByTestId('subject')).toHaveTextContent('no-context');

    rerender(tree(true));
    expect(screen.getByTestId('subject')).toHaveTextContent('context');
  });
});
