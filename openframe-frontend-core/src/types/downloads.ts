/**
 * The download page's wire shape and vocabulary: what the OpenFrame apps are
 * installed from. The hub answers `DOWNLOADS_API_PATH` with `DownloadsPublic`;
 * the lib's `<DownloadAppsPage>` renders it (hub SSR, openframe-frontend through
 * its `/content` proxy, the embedding example).
 */
import type { DesktopOs } from '../utils/visitor-os';

/** GET endpoint for the public downloads projection (the hub's path; embedders prefix their proxy). */
export const DOWNLOADS_API_PATH = '/api/downloads';

/** How long a copy stays fresh: the CDN window of the route, and the page's revalidation age. */
export const DOWNLOADS_CACHE_SECONDS = 300;

export const DOWNLOADS_TITLE = 'Download OpenFrame';
export const DOWNLOADS_TAGLINE =
  'Install it on the computer you manage IT from, and on your phone. One account everywhere.';
/** The title and subtitle when a host offers the mobile app only. */
export const DOWNLOADS_MOBILE_TITLE = 'Get the OpenFrame app';
export const DOWNLOADS_MOBILE_TAGLINE =
  'Alerts and tickets on your phone, signed in with the account you already have.';

/**
 * What a row is: an installer file, or a one-line package manager install. THE
 * one declaration: the type, the server's rows and every reader derive from it.
 */
export const APP_DOWNLOAD_KINDS = ['binary', 'command'] as const;
export type AppDownloadKind = (typeof APP_DOWNLOAD_KINDS)[number];

/** One way to install the desktop app on one system. */
export interface AppDownload {
  id: string;
  kind: AppDownloadKind;
  os: DesktopOs;
  /** `universal`, `x64`, `arm64`; null for a command. */
  architecture: string | null;
  /** The installer's address (`binary`). */
  url: string | null;
  /** The whole command to paste (`command`). */
  command: string | null;
  /** "macOS 13+". */
  minOsLabel: string | null;
  /** The package manager's name (`command`), or the button's own words (`binary`). */
  label: string | null;
}

/**
 * The install link a phone opens to reach its store, and the QR code that
 * encodes it. Both are the server's: the link is an address on the website
 * (answered there with a redirect by device), and the artwork is drawn from it
 * on the server, so the two can never disagree and the lib names no host.
 */
export interface MobileAppInstallLink {
  /** The absolute address the code encodes. */
  url: string;
  /** The side of the artwork's square viewBox, quiet zone included. */
  qrViewBoxSize: number;
  /** The dark modules as one SVG path of filled rectangles (`fill` draws them). */
  qrPath: string;
}

/** Where the mobile app is installed from. A store the server names no listing for is null, and is not offered. */
export interface MobileAppLinks {
  appStoreUrl: string | null;
  googlePlayUrl: string | null;
  /** The install link and its QR code. Absent or null: no code is drawn. */
  install?: MobileAppInstallLink | null;
}

/**
 * Everything the download page shows. All of it is the server's: the lib holds
 * no link of its own and falls back to none, so what is missing is not drawn.
 */
export interface DownloadsPublic {
  /** The desktop installers and install commands, in the order they are offered. Per system, the first installer is the default. */
  desktop: AppDownload[];
  /** The mobile app's store listings. */
  mobile: MobileAppLinks;
}

/** A system's name on a button and a card. */
export const DESKTOP_OS_LABELS: Record<DesktopOs, string> = { mac: 'Mac', windows: 'Windows', linux: 'Linux' };

/** An architecture's name beside a button, when a system has more than one installer. */
export const DOWNLOAD_ARCHITECTURE_LABELS: Record<string, string> = {
  universal: 'Apple Silicon and Intel',
  x64: 'x64',
  arm64: 'ARM',
};

/** What a host learns when a visitor takes an install action on the page. */
export interface DownloadActionEvent {
  /** `installer`: a download button. `command`: a copied install command. */
  action: 'installer' | 'command';
  /** The row's id (`mac`, `windows-arm64`, `homebrew`). */
  id: string;
  os: DesktopOs;
  architecture: string | null;
}
