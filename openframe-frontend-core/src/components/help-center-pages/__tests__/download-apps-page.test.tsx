import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDownloadsStore } from '../../../hooks/use-downloads';
import {
  DOWNLOADS_MOBILE_TITLE,
  DOWNLOADS_TITLE,
  type AppDownload,
  type DownloadActionEvent,
  type DownloadsPublic,
} from '../../../types/downloads';
import { DownloadAppsPage } from '../download-apps-page';

const binary = (id: string, os: AppDownload['os'], architecture: string, url: string): AppDownload => ({
  id,
  kind: 'binary',
  os,
  architecture,
  url,
  command: null,
  minOsLabel: null,
  label: null,
});

const APP_STORE_URL = 'https://apps.test/app';
const GOOGLE_PLAY_URL = 'https://play.test/app';
const INSTALL = { url: 'https://www.site.test/mobile', qrViewBoxSize: 37, qrPath: 'M4 4h7v1h-7z' };
const MOBILE = { appStoreUrl: APP_STORE_URL, googlePlayUrl: GOOGLE_PLAY_URL, install: INSTALL };

const DATA: DownloadsPublic = {
  mobile: MOBILE,
  desktop: [
    binary('mac', 'mac', 'universal', 'https://gateway.test/mac'),
    binary('windows', 'windows', 'x64', 'https://gateway.test/x64'),
    binary('windows-arm64', 'windows', 'arm64', 'https://gateway.test/arm64'),
    {
      id: 'homebrew',
      kind: 'command',
      os: 'mac',
      architecture: null,
      url: null,
      command: 'brew install --cask openframe',
      minOsLabel: null,
      label: 'Homebrew',
    },
  ],
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  resetDownloadsStore();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DownloadAppsPage', () => {
  it('renders the server-read rows without a request, every system at once', () => {
    render(<DownloadAppsPage initialData={DATA} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(DOWNLOADS_TITLE);
    expect(screen.getByRole('link', { name: 'Download for Mac' })).toHaveAttribute('href', 'https://gateway.test/mac');
    expect(screen.getByText('brew install --cask openframe')).toBeInTheDocument();
    // No tab hides a system: nothing moves when a visitor looks for another one.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download for Windows (x64)' })).toBeInTheDocument();
  });

  it('tells two installers of one system apart by architecture, the first as the default', () => {
    render(<DownloadAppsPage initialData={DATA} />);
    expect(screen.getByRole('link', { name: 'Download for Windows (x64)' })).toHaveAttribute(
      'href',
      'https://gateway.test/x64',
    );
    expect(screen.getByRole('link', { name: 'Download for Windows (ARM)' })).toHaveAttribute(
      'href',
      'https://gateway.test/arm64',
    );
  });

  it('reports an installer download and a copied command to the host', () => {
    const onDownloadAction = vi.fn<(event: DownloadActionEvent) => void>();
    render(<DownloadAppsPage initialData={DATA} onDownloadAction={onDownloadAction} />);
    fireEvent.click(screen.getByRole('link', { name: 'Download for Mac' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy the Homebrew command' }));
    expect(onDownloadAction.mock.calls.map(([event]) => [event.action, event.id])).toEqual([
      ['installer', 'mac'],
      ['command', 'homebrew'],
    ]);
  });

  it('offers the mobile app only when the host turns the desktop app off', () => {
    render(
      <DownloadAppsPage
        initialData={DATA}
        showDesktop={false}
        web={{
          title: 'No install',
          description: 'Runs in the browser.',
          action: <button type="button">host action</button>,
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(DOWNLOADS_MOBILE_TITLE);
    expect(screen.queryByText('Desktop app')).not.toBeInTheDocument();
    const hrefs = screen.getAllByRole('link').map(link => link.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining([APP_STORE_URL, GOOGLE_PLAY_URL]));
    expect(screen.getByRole('heading', { name: 'No install' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'host action' })).toBeInTheDocument();
  });

  it('draws a badge only for a store the server names a listing for', () => {
    render(
      <DownloadAppsPage initialData={{ desktop: [], mobile: { appStoreUrl: APP_STORE_URL, googlePlayUrl: null } }} />,
    );
    expect(screen.getByRole('heading', { name: 'iPhone and iPad' })).toBeInTheDocument();
    const hrefs = screen.getAllByRole('link').map(link => link.getAttribute('href'));
    expect(hrefs).toContain(APP_STORE_URL);
    expect(hrefs).not.toContain(GOOGLE_PLAY_URL);
  });

  it('draws no mobile section, and holds no link of its own, when the server names no store', () => {
    render(
      <DownloadAppsPage initialData={{ desktop: DATA.desktop, mobile: { appStoreUrl: null, googlePlayUrl: null } }} />,
    );
    expect(screen.queryByText('Mobile app')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /QR code/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download for Mac' })).toBeInTheDocument();
  });

  it('reads the answer from the server when the host has no copy', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DATA), { status: 200 }));
    render(<DownloadAppsPage endpoint="/content/api/downloads" />);
    expect(await screen.findByRole('link', { name: 'Download for Mac' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/content/api/downloads');
  });

  it('gives a system a card only for what the deployment names', () => {
    const homebrew = DATA.desktop.find(row => row.id === 'homebrew') as AppDownload;
    // Windows has installers and no command; the Mac has a command and no installer.
    render(
      <DownloadAppsPage
        initialData={{ mobile: MOBILE, desktop: [homebrew, ...DATA.desktop.filter(row => row.os === 'windows')] }}
      />,
    );
    expect(screen.getByText('brew install --cask openframe')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Download for Mac' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download for Windows (x64)' })).toBeInTheDocument();
  });

  it('leaves a system with neither an installer nor a command out', () => {
    render(
      <DownloadAppsPage initialData={{ mobile: MOBILE, desktop: DATA.desktop.filter(row => row.os === 'windows') }} />,
    );
    expect(screen.queryByRole('heading', { name: 'Mac' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Windows' })).toBeInTheDocument();
  });

  it('shows no desktop section when the deployment names no installer', () => {
    render(<DownloadAppsPage initialData={{ desktop: [], mobile: MOBILE }} />);
    expect(screen.queryByText('Desktop app')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(DOWNLOADS_MOBILE_TITLE);
  });

  it('draws the install code and prints its address only when the server sends an install link', () => {
    const { unmount } = render(<DownloadAppsPage initialData={{ desktop: [], mobile: MOBILE }} />);
    expect(screen.getByRole('img', { name: `QR code for ${INSTALL.url}` })).toBeInTheDocument();
    expect(screen.getByText(/site\.test\/mobile on your phone/)).toBeInTheDocument();
    unmount();

    resetDownloadsStore();
    render(
      <DownloadAppsPage
        initialData={{ desktop: [], mobile: { appStoreUrl: APP_STORE_URL, googlePlayUrl: GOOGLE_PLAY_URL } }}
      />,
    );
    expect(screen.queryByRole('img', { name: /QR code/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Scan with your phone')).not.toBeInTheDocument();
  });
});
