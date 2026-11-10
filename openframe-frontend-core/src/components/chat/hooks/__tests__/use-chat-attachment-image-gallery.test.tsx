import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { type ChatRuntime, ChatRuntimeContext } from '../../../../contexts/chat-runtime-context';
import { useChatAttachmentImageGallery } from '../use-chat-attachment-image-gallery';

// vitest.setup.ts replaces window.location with a stub that has an href and no origin.
const PAGE = new URL(window.location.href).origin;
const GATEWAY_PREFIX = 'https://tenant.example.com/content/api/storage/view/chat-attachments/';

function Thread({ children }: { children: ReactNode }) {
  const { panelRef, modal } = useChatAttachmentImageGallery();
  return (
    <>
      <div ref={panelRef}>{children}</div>
      {modal}
    </>
  );
}

function renderThread(attachmentViewUrlPrefix: string, thread: ReactNode) {
  const runtime = { endpoints: { attachmentViewUrlPrefix } } as ChatRuntime;
  render(
    <ChatRuntimeContext.Provider value={runtime}>
      <Thread>{thread}</Thread>
    </ChatRuntimeContext.Provider>,
  );
}

// A bearer-auth host draws every picture from a blob fetched with the bearer; the address stays in data-asset-src.
const messageWithTwoAttachments = (
  <div data-message-role="user">
    <img alt="Avatar" src={`blob:${PAGE}/avatar`} data-asset-src="https://tenant.example.com/api/users/u-1/avatar" />
    <img alt="First" src={`blob:${PAGE}/first`} data-asset-src={`${GATEWAY_PREFIX}first.png`} />
    <img alt="Second" src={`blob:${PAGE}/second`} data-asset-src={`${GATEWAY_PREFIX}second.png`} />
  </div>
);

describe('useChatAttachmentImageGallery', () => {
  it("opens the message's attachments at their addresses, on the one clicked, when they are drawn from blobs", () => {
    renderThread(GATEWAY_PREFIX, messageWithTwoAttachments);

    fireEvent.click(screen.getByAltText('Second'));

    const gallery = screen.getByRole('dialog');
    expect(within(gallery).getByText('2 / 2')).toBeInTheDocument();
    expect(within(gallery).getByRole('img')).toHaveAttribute('src', `${GATEWAY_PREFIX}second.png`);
    fireEvent.click(within(gallery).getByRole('button', { name: 'Previous image' }));
    expect(within(gallery).getByRole('img')).toHaveAttribute('src', `${GATEWAY_PREFIX}first.png`);
  });

  it('opens nothing for a picture in the message that is not an attachment', () => {
    renderThread(GATEWAY_PREFIX, messageWithTwoAttachments);

    fireEvent.click(screen.getByAltText('Avatar'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens an attachment outside any message on its own address', () => {
    renderThread(
      GATEWAY_PREFIX,
      <img alt="Loose" src={`blob:${PAGE}/loose`} data-asset-src={`${GATEWAY_PREFIX}loose.png`} />,
    );

    fireEvent.click(screen.getByAltText('Loose'));

    expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute('src', `${GATEWAY_PREFIX}loose.png`);
  });

  it('resolves an address relative to the page, as dev-ticket web keeps it, before matching the prefix', () => {
    renderThread(
      `${PAGE}/content/api/storage/view/chat-attachments/`,
      <div data-message-role="user">
        <img
          alt="Pasted"
          src={`blob:${PAGE}/pasted`}
          data-asset-src="/content/api/storage/view/chat-attachments/a.png"
        />
      </div>,
    );

    fireEvent.click(screen.getByAltText('Pasted'));

    expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute(
      'src',
      `${PAGE}/content/api/storage/view/chat-attachments/a.png`,
    );
  });
});
