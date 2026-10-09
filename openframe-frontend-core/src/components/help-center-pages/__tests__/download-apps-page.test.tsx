import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DOWNLOADS_MOBILE_TITLE,
  DOWNLOADS_TITLE,
  type AppDownload,
  type DownloadsPublic,
} from '../../../types/downloads';
import { APP_STORE_URL, GOOGLE_PLAY_URL } from '../../../utils/mobile-app';
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

const DATA: DownloadsPublic = {
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
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DownloadAppsPage', () => {
  it('renders the server-read rows without a request, one system at a time', () => {
    render(<DownloadAppsPage initialData={DATA} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(DOWNLOADS_TITLE);
    // jsdom names no system, so the first tab is open: the Mac installer and its command.
    expect(screen.getByRole('link', { name: 'Download for Mac' })).toHaveAttribute('href', 'https://gateway.test/mac');
    expect(screen.getByText('brew install --cask openframe')).toBeInTheDocument();
    expect(screen.queryByText(/Download for Windows/)).not.toBeInTheDocument();
  });

  it('tells two installers of one system apart by architecture, the first as the default', () => {
    render(<DownloadAppsPage initialData={DATA} />);
    fireEvent.click(screen.getByText('Windows'));
    expect(screen.getByRole('link', { name: 'Download for Windows (x64)' })).toHaveAttribute(
      'href',
      'https://gateway.test/x64',
    );
    expect(screen.getByRole('link', { name: 'Download for Windows (ARM)' })).toHaveAttribute(
      'href',
      'https://gateway.test/arm64',
    );
    // A system with no package manager shows no command.
    expect(screen.queryByText('Or install from the command line')).not.toBeInTheDocument();
  });

  it('reports an installer download and a copied command to the host', () => {
    const onDownloadAction = vi.fn();
    render(<DownloadAppsPage initialData={DATA} onDownloadAction={onDownloadAction} />);
    fireEvent.click(screen.getByRole('link', { name: 'Download for Mac' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy command' }));
    expect(onDownloadAction.mock.calls.map(([event]) => [event.action, event.id])).toEqual([
      ['installer', 'mac'],
      ['command', 'homebrew'],
    ]);
  });

  it('offers the mobile app only, with no request, when the host turns the desktop app off', () => {
    render(<DownloadAppsPage showDesktop={false} footer={<p>host footer</p>} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(DOWNLOADS_MOBILE_TITLE);
    expect(screen.queryByText('Desktop app')).not.toBeInTheDocument();
    const hrefs = screen.getAllByRole('link').map(link => link.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining([APP_STORE_URL, GOOGLE_PLAY_URL]));
    expect(screen.getByText('host footer')).toBeInTheDocument();
  });

  it('shows no desktop section when the deployment names no installer', () => {
    render(<DownloadAppsPage initialData={{ desktop: [] }} />);
    expect(screen.queryByText('Desktop app')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(DOWNLOADS_MOBILE_TITLE);
  });
});
