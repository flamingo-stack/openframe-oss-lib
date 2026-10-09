'use client';

/**
 * `<DownloadAppsPage>`: every way to install OpenFrame, on one page.
 *
 *   - The desktop app: every system at once, one card each (a download page
 *     lists its platforms; it does not hide them behind tabs, so nothing moves
 *     when a visitor looks for another system). In a card the installer is THE
 *     action (the other architecture is a quieter button) and each package
 *     manager is one line under it, with its copy button.
 *   - The mobile app: the store badges, and the install QR code beside them.
 *   - `footer`: the host's own last word (the website's "start on the web" card).
 *
 * DATA: `useSelfFetch` against `endpoint` (default `DOWNLOADS_API_PATH`;
 * embedders pass their `/content` proxy path). `initialData` (hub SSR) skips the
 * first fetch. The store links and the QR code are the lib's own constants, so
 * the mobile section renders without the request.
 *
 * A HOST DECIDES `showDesktop`: the website shows the desktop app only to a
 * visitor whose main action is the download; the desktop shell hides it (it is
 * the app already running).
 *
 * The chrome is the canonical `PageShell` + frozen `PageLayout`.
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from '../../embed-shims/next-navigation';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import {
  DESKTOP_OS_LABELS,
  DOWNLOAD_ARCHITECTURE_LABELS,
  DOWNLOADS_API_PATH,
  DOWNLOADS_CACHE_SECONDS,
  DOWNLOADS_MOBILE_TAGLINE,
  DOWNLOADS_MOBILE_TITLE,
  DOWNLOADS_TAGLINE,
  DOWNLOADS_TITLE,
  type AppDownload,
  type DownloadActionEvent,
  type DownloadsPublic,
} from '../../types/downloads';
import {
  APP_STORE_URL,
  DOWNLOAD_PAGE_STORE_PARAM,
  GOOGLE_PLAY_URL,
  MOBILE_APP_INSTALL_HOST_PATH,
  resolveMobileStoreUrl,
} from '../../utils/mobile-app';
import { DESKTOP_OSES, type DesktopOs } from '../../utils/visitor-os';
import { CommandBox } from '../features/command-box';
import { AppleLogoIcon } from '../icons-v2-generated/brand-logos/apple-logo-icon';
import { WindowsLogoGreyIcon } from '../icons-v2-generated/brand-logos/windows-logo-grey-icon';
import { Download01Icon } from '../icons-v2-generated/interface/download-01-icon';
import { PageShell } from '../layout/article-detail-layout';
import { PageLayout } from '../layout/page-layout';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui/button/button';
import { LoadError } from '../ui/error-state';
import { FeatureCardGrid, type FeatureCardItem } from '../ui/feature-card';
import { MobileAppQr } from '../ui/mobile-app-qr';
import { StoreBadgeLinks } from '../ui/store-badges';

export interface DownloadAppsPageProps {
  /** GET endpoint for the public projection. Default `DOWNLOADS_API_PATH`. */
  endpoint?: string;
  /** Optional SSR hydrate (hub server-read): skips the initial client fetch. */
  initialData?: DownloadsPublic;
  /** Render the standalone `<PageShell>`. Default true. Pass false when the host
   *  layout already provides the page container (e.g. openframe-frontend). */
  shell?: boolean;
  /** Back-button config. Default: none. */
  backButton?: { label?: string; href?: string } | false;
  /** Page title. Default by what is offered (`DOWNLOADS_TITLE` / `DOWNLOADS_MOBILE_TITLE`). */
  title?: string;
  /** Page subtitle. Default by what is offered. */
  subtitle?: string;
  /** Offer the desktop app. Default true. False: the mobile app only, and no request is made. */
  showDesktop?: boolean;
  /** Open the store listings in a new tab. Default true. */
  openStoresInNewTab?: boolean;
  /** Called when a visitor downloads an installer or copies an install command (the host's analytics). */
  onDownloadAction?: (event: DownloadActionEvent) => void;
  /** The host's own closing block, under the mobile app. */
  footer?: ReactNode;
}

const SECTIONS_CLASS = 'flex flex-col gap-[var(--spacing-system-xlf)]';
const SECTION_CLASS = 'flex flex-col gap-[var(--spacing-system-lf)]';
/** The frame around a card grid: the grid itself is only its hairlines. */
const GRID_FRAME_CLASS = 'overflow-hidden rounded-md border border-ods-border bg-ods-card';
const GRID_ITEM_CLASS = 'bg-transparent p-[var(--spacing-system-lf)]';
const CARD_BODY_CLASS = 'flex flex-col gap-[var(--spacing-system-mf)]';
const BUTTONS_CLASS = 'flex flex-col gap-[var(--spacing-system-sf)]';

const OS_ICONS: Partial<Record<DesktopOs, NonNullable<FeatureCardItem['icon']>>> = {
  mac: AppleLogoIcon,
  windows: WindowsLogoGreyIcon,
};

interface SystemRows {
  os: DesktopOs;
  installers: AppDownload[];
  commands: AppDownload[];
}

/** The rows per system, in the order they arrived. A system with no installer is not offered. */
function rowsBySystem(downloads: readonly AppDownload[]): SystemRows[] {
  return DESKTOP_OSES.map(os => ({
    os,
    installers: downloads.filter(d => d.os === os && d.kind === 'binary' && d.url),
    commands: downloads.filter(d => d.os === os && d.kind === 'command' && d.command),
  })).filter(system => system.installers.length > 0);
}

function installerLabel(download: AppDownload, siblings: number): string {
  if (download.label) return download.label;
  const label = `Download for ${DESKTOP_OS_LABELS[download.os]}`;
  const architecture = download.architecture ? DOWNLOAD_ARCHITECTURE_LABELS[download.architecture] : null;
  // One installer for a system needs no qualifier; two are told apart by their architecture.
  return siblings > 1 && architecture ? `${label} (${architecture})` : label;
}

/** One system's card body: its installers, then each package manager as one line. */
function SystemCardBody({
  system,
  onDownloadAction,
}: {
  system: SystemRows;
  onDownloadAction?: DownloadAppsPageProps['onDownloadAction'];
}) {
  const { copy } = useCopyToClipboard({
    successTitle: 'Copied',
    successDescription: 'Paste it into your terminal and press Return.',
  });
  const report = (action: DownloadActionEvent['action'], row: AppDownload) =>
    onDownloadAction?.({ action, id: row.id, os: row.os, architecture: row.architecture });
  return (
    <div className={CARD_BODY_CLASS}>
      <div className={BUTTONS_CLASS}>
        {system.installers.map((download, index) => (
          <Button
            key={download.id}
            variant={index === 0 ? 'accent' : 'outline'}
            href={download.url ?? undefined}
            download
            leftIcon={<Download01Icon className="h-5 w-5" />}
            className="w-full"
            onClick={() => report('installer', download)}
          >
            {installerLabel(download, system.installers.length)}
          </Button>
        ))}
      </div>
      {system.commands.map(row =>
        row.command ? (
          <CommandBox
            key={row.id}
            title={row.label ?? undefined}
            command={row.command}
            maxLines={1}
            commandClassName="text-ods-accent"
            copyAriaLabel={`Copy the ${row.label ?? 'install'} command`}
            onCopy={() => {
              void copy(row.command as string);
              report('command', row);
            }}
          />
        ) : null,
      )}
    </div>
  );
}

/** A system's card in the grid: its logo, its name, what it needs, then its ways in. */
function systemItem(system: SystemRows, onDownloadAction: DownloadAppsPageProps['onDownloadAction']): FeatureCardItem {
  const requirements = [...new Set(system.installers.map(d => d.minOsLabel).filter((l): l is string => !!l))];
  const icon = OS_ICONS[system.os];
  return {
    ...(icon ? { icon } : {}),
    title: DESKTOP_OS_LABELS[system.os],
    ...(requirements.length > 0 ? { subtitle: `Requires ${requirements.join(' or ')}` } : {}),
    content: <SystemCardBody system={system} onDownloadAction={onDownloadAction} />,
  };
}

/** The grid's placeholder cards while the rows load: a title and subtitle bar each (the grid's own), and a button's box. */
const LOADING_ITEMS: FeatureCardItem[] = ['mac', 'windows'].map(os => ({
  title: os,
  subtitle: os,
  content: (
    <div className={CARD_BODY_CLASS}>
      <UnifiedSkeleton className="h-12 w-full rounded-md" />
      <UnifiedSkeleton className="h-12 w-full rounded-md" />
    </div>
  ),
}));

function DesktopSection({
  data,
  isLoading,
  error,
  reload,
  onDownloadAction,
}: {
  data: DownloadsPublic | null;
  isLoading: boolean;
  error: boolean;
  reload: () => void;
  onDownloadAction?: DownloadAppsPageProps['onDownloadAction'];
}) {
  const systems = data ? rowsBySystem(data.desktop) : [];

  let body: ReactNode;
  if (error && !data) {
    body = <LoadError message="Could not load the installers" onRetry={reload} />;
  } else if (!data) {
    if (!isLoading) return null;
    body = (
      <div className={GRID_FRAME_CLASS} aria-busy="true" aria-label="Loading the installers">
        <FeatureCardGrid items={LOADING_ITEMS} columns={2} itemClassName={GRID_ITEM_CLASS} loading />
      </div>
    );
  } else if (systems.length === 0) {
    // The deployment names no installer: the section is not shown.
    return null;
  } else {
    body = (
      <div className={GRID_FRAME_CLASS}>
        <FeatureCardGrid
          items={systems.map(system => systemItem(system, onDownloadAction))}
          columns={2}
          itemClassName={GRID_ITEM_CLASS}
          accentClassName="text-ods-text-secondary"
        />
      </div>
    );
  }
  return (
    <section aria-labelledby="download-desktop" className={SECTION_CLASS}>
      <h2 id="download-desktop" className="m-0 text-ods-text-primary text-h2">
        Desktop app
      </h2>
      {body}
    </section>
  );
}

export function DownloadAppsPage({
  endpoint = DOWNLOADS_API_PATH,
  initialData,
  shell = true,
  backButton = false,
  title,
  subtitle,
  showDesktop = true,
  openStoresInNewTab = true,
  onDownloadAction,
  footer,
}: DownloadAppsPageProps) {
  const { data, isLoading, error, reload } = useSelfFetch<DownloadsPublic>(showDesktop ? endpoint : null, {
    initialData,
    revalidateOnVisibleAfterMs: DOWNLOADS_CACHE_SECONDS * 1000,
  });
  // The desktop app is "offered" until the data says the deployment names no installer.
  const offersDesktop = showDesktop && (!data || rowsBySystem(data.desktop).length > 0);

  useEffect(() => {
    // The install QR code arrives with this parameter: a phone or a tablet goes
    // straight on to its store. `replace`, so Back returns to whatever sent the
    // visitor here. Anyone else who opens the page on a phone reads it.
    if (!new URLSearchParams(window.location.search).has(DOWNLOAD_PAGE_STORE_PARAM)) return;
    const storeUrl = resolveMobileStoreUrl(navigator.userAgent, navigator.maxTouchPoints);
    if (storeUrl) window.location.replace(storeUrl);
  }, []);

  return (
    <DownloadAppsChrome
      shell={shell}
      backButton={backButton}
      title={title ?? (offersDesktop ? DOWNLOADS_TITLE : DOWNLOADS_MOBILE_TITLE)}
      subtitle={subtitle ?? (offersDesktop ? DOWNLOADS_TAGLINE : DOWNLOADS_MOBILE_TAGLINE)}
    >
      <div className={SECTIONS_CLASS}>
        {showDesktop && (
          <DesktopSection
            data={data}
            isLoading={isLoading}
            error={error}
            reload={reload}
            onDownloadAction={onDownloadAction}
          />
        )}

        <section aria-labelledby="download-mobile" className={SECTION_CLASS}>
          <h2 id="download-mobile" className="m-0 text-ods-text-primary text-h2">
            Mobile app
          </h2>
          <div className={GRID_FRAME_CLASS}>
            <FeatureCardGrid
              columns={2}
              itemClassName={GRID_ITEM_CLASS}
              accentClassName="text-ods-text-secondary"
              items={[
                {
                  title: 'iPhone, iPad and Android',
                  subtitle: 'Get alerts and respond to tickets on the go',
                  content: (
                    <StoreBadgeLinks
                      appStoreUrl={APP_STORE_URL}
                      googlePlayUrl={GOOGLE_PLAY_URL}
                      openInNewTab={openStoresInNewTab}
                    />
                  ),
                },
                {
                  title: 'Scan with your phone',
                  subtitle: MOBILE_APP_INSTALL_HOST_PATH,
                  // The plate is light on purpose: a QR code is read dark on light.
                  content: (
                    <div className="w-fit rounded-md bg-ods-bg-inverted p-[var(--spacing-system-sf)]">
                      <MobileAppQr className="h-[120px] w-[120px]" />
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </section>

        {footer}
      </div>
    </DownloadAppsChrome>
  );
}

/** The page's chrome: the standalone `PageShell` or the host's padded box, and the frozen `PageLayout` header. */
function DownloadAppsChrome({
  shell,
  title,
  subtitle,
  backButton,
  children,
}: Required<Pick<DownloadAppsPageProps, 'shell' | 'title' | 'subtitle' | 'backButton'>> & { children: ReactNode }) {
  const router = useRouter();
  const backCfg =
    backButton === false
      ? undefined
      : { label: backButton.label ?? 'Back to home', onClick: () => router.push(backButton.href ?? '/') };
  const inner = (
    <PageLayout title={title} subtitle={subtitle} backButton={backCfg} titleSize="h1" titleWrap>
      {children}
    </PageLayout>
  );
  return shell ? <PageShell>{inner}</PageShell> : <div className="page-shell-content">{inner}</div>;
}
