import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DownloadAppsPage } from '../components/help-center-pages/download-apps-page';
import type { AppDownload, DownloadsPublic } from '../types/downloads';

const installer = (id: string, os: AppDownload['os'], architecture: string, minOsLabel: string): AppDownload => ({
  id,
  kind: 'binary',
  os,
  architecture,
  url: `https://www.example.com/download/${id}`,
  command: null,
  minOsLabel,
  label: null,
});

const packageManager = (id: string, os: AppDownload['os'], label: string, command: string): AppDownload => ({
  id,
  kind: 'command',
  os,
  architecture: null,
  url: null,
  command,
  minOsLabel: null,
  label,
});

const INSTALLERS = [
  installer('mac', 'mac', 'universal', 'macOS 13+'),
  installer('windows', 'windows', 'x64', 'Windows 10+'),
  installer('windows-arm64', 'windows', 'arm64', 'Windows 11+'),
];

const MOBILE = {
  appStoreUrl: 'https://www.example.com/app-store',
  googlePlayUrl: 'https://www.example.com/google-play',
  install: {
    url: 'https://www.example.com/mobile',
    qrViewBoxSize: 37,
    qrPath: 'M4 4h7v7h-7zM26 4h7v7h-7zM4 26h7v7h-7z',
  },
};

// Stories pass `initialData`, so the page never fetches. The rows have the shape the hub's
// `GET /api/downloads` answers.
const DOWNLOADS: DownloadsPublic = {
  desktop: [
    ...INSTALLERS,
    packageManager('homebrew', 'mac', 'Homebrew', 'brew install --cask openframe-console'),
    packageManager('chocolatey', 'windows', 'Chocolatey', 'choco install openframe-console -y'),
  ],
  mobile: MOBILE,
};

const meta = {
  title: 'Features/DownloadAppsPage',
  component: DownloadAppsPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Every way to install OpenFrame, on one page. All of it is the server's answer (`useDownloads` or `initialData`): a package manager command is drawn only when the deployment names the package.",
      },
    },
  },
  args: { initialData: DOWNLOADS },
} satisfies Meta<typeof DownloadAppsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Installers, with each package manager as one row under them. */
export const WithPackageManagers: Story = {};

/** No package names in the deployment: the installers alone. */
export const InstallersOnly: Story = {
  args: { initialData: { desktop: INSTALLERS, mobile: MOBILE } },
};
