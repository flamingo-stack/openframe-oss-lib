import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockSenderModal } from '../blocked-senders';

const fetchMock = vi.fn<typeof fetch>();
const ok = () =>
  new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(ok()));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function open(kind: 'domain' | 'address', onBlocked = vi.fn(), onClose = vi.fn()) {
  render(
    <BlockSenderModal endpoint="/api/admin/spam?env=qa" kind={kind} isOpen onClose={onClose} onBlocked={onBlocked} />,
  );
  return { onBlocked, onClose };
}

/** The modal's own save button (the last button with the label: the title can carry the same words). */
function save(label: string): HTMLElement {
  const buttons = screen.getAllByRole('button', { name: label });
  return buttons[buttons.length - 1] as HTMLElement;
}

function firstRequest(): { url: string; body: unknown } {
  const call = fetchMock.mock.calls[0];
  return { url: String(call?.[0]), body: JSON.parse(String(call?.[1]?.body)) };
}

describe('BlockSenderModal', () => {
  it('refuses what is not a domain, and a shared mail provider as a domain', () => {
    open('domain');
    const field = screen.getByLabelText('Domain');
    fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: 'Link spam' } });

    fireEvent.change(field, { target: { value: 'https://rogue.example' } });
    fireEvent.blur(field);
    expect(screen.getByText('Enter email domain only (e.g., openframe.ai), not a URL')).toBeInTheDocument();
    expect(save('Block domain')).toBeDisabled();

    fireEvent.change(field, { target: { value: 'Gmail.com' } });
    expect(screen.getByText(/gmail\.com is a shared email provider/)).toBeInTheDocument();
    expect(save('Block domain')).toBeDisabled();
  });

  it('blocks a cleaned domain with its reason, then tells the host and closes', async () => {
    const { onBlocked, onClose } = open('domain');
    fireEvent.change(screen.getByLabelText('Domain'), { target: { value: ' @Rogue-MSP.example ' } });
    fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: ' Silent installs ' } });
    fireEvent.click(save('Block domain'));

    await waitFor(() => expect(onBlocked).toHaveBeenCalled());
    expect(firstRequest()).toEqual({
      url: '/api/admin/spam/domains?env=qa',
      body: { value: 'rogue-msp.example', reason: 'Silent installs' },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('blocks one address and refuses one that is not an address', async () => {
    const { onBlocked } = open('address');
    const field = screen.getByLabelText('Email address');
    fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: 'Link spam' } });
    fireEvent.change(field, { target: { value: 'not an address' } });
    fireEvent.blur(field);
    expect(screen.getByText('Enter one email address (e.g., spammer@gmail.com)')).toBeInTheDocument();

    fireEvent.change(field, { target: { value: 'Spammer@Gmail.com' } });
    fireEvent.click(save('Block address'));
    await waitFor(() => expect(onBlocked).toHaveBeenCalled());
    expect(firstRequest()).toEqual({
      url: '/api/admin/spam/emails?env=qa',
      body: { value: 'spammer@gmail.com', reason: 'Link spam' },
    });
  });
});
