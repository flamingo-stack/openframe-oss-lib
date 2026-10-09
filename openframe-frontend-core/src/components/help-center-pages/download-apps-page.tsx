'use client';

/**
 * `<DownloadAppsPage>`: every way to install OpenFrame, on one page.
 *
 *   - The desktop app: every system at once, one card each (a download page
 *     lists its platforms; it does not hide them behind tabs, so nothing moves
 *     when a visitor looks for another system). In a card the installer is THE
 *     action (the other architecture is a quieter button) and each package
 *     manager is one line under it, with its copy button.
 *   - The mobile app: the store badges, and the install QR code beside them. The
 *     code and the address it encodes are the server's (`mobile.install`): the
 *     website's install link, which the server answers with a redirect to the
 *     phone's store. This page redirects nobody, and with no install link from
 *     the server it draws no code.
 *   - `web`: the way in for someone who installs nothing (the website's trial
 *     signup). The host names the words and the button; the page draws the card,
 *     in the frame of every other card on it.
 *
 * DATA: all of it is the server's answer (`DownloadsPublic`), read by
 * `useDownloads` against `endpoint` (default `DOWNLOADS_API_PATH`; embedders
 * pass their `/content` proxy path), the one request every download button on
 * the page shares. `initialData` (hub SSR) is the answer, with no fetch. The
 * lib holds no link of its own and no fallback: the page ADAPTS, so a system
 * with no installer and no command has no card, a store with no listing has no
 * badge, and a section with nothing to offer is not drawn.
 *
 * A HOST DECIDES `showDesktop`: the website shows the desktop app only to a
 * visitor whose main action is the download; the desktop shell hides it (it is
 * the app already running).
 *
 * The chrome is the canonical `PageShell` + frozen `PageLayout`.
 */

import type { ComponentType, ReactNode } from 'react';
import { useRouter } from '../../embed-shims/next-navigation';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';
import { useDownloads } from '../../hooks/use-downloads';
import {
  DESKTOP_OS_LABELS,
  DOWNLOAD_ARCHITECTURE_LABELS,
  DOWNLOADS_API_PATH,
  DOWNLOADS_MOBILE_TAGLINE,
  DOWNLOADS_MOBILE_TITLE,
  DOWNLOADS_TAGLINE,
  DOWNLOADS_TITLE,
  type AppDownload,
  type DownloadActionEvent,
  type DownloadsPublic,
  type MobileAppLinks,
} from '../../types/downloads';
import { cn } from '../../utils/cn';
import { printableUrl } from '../../utils/mobile-app';
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
  /** Offer the desktop app. Default true. False: the mobile app only. */
  showDesktop?: boolean;
  /** Open the store listings in a new tab. Default true. */
  openStoresInNewTab?: boolean;
  /** Called when a visitor downloads an installer or copies an install command (the host's analytics). */
  onDownloadAction?: (event: DownloadActionEvent) => void;
  /** The closing card, under the mobile app: using OpenFrame without installing anything. Default: none. */
  web?: DownloadAppsWebOption;
}

/** The "no install" card: the host's words and its own button (the page holds no signup link). */
export interface DownloadAppsWebOption {
  title: string;
  description: string;
  /** The host's button (the website's trial signup). */
  action: ReactNode;
}

const SECTIONS_CLASS = 'flex flex-col gap-[var(--spacing-system-xlf)]';
const SECTION_CLASS = 'flex flex-col gap-[var(--spacing-system-lf)]';
const CARDS_GRID_CLASS = 'grid grid-cols-1 gap-[var(--spacing-system-lf)] content-md:grid-cols-2';
/** One card takes the row; two or more share it. */
const cardsGridClass = (cards: number) => (cards > 1 ? CARDS_GRID_CLASS : 'grid grid-cols-1');
const CARD_CLASS =
  'flex flex-col gap-[var(--spacing-system-lf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-lf)]';
const CARD_HEADER_CLASS = 'flex items-center gap-[var(--spacing-system-sf)]';
const BUTTONS_CLASS = 'flex flex-wrap gap-[var(--spacing-system-sf)]';
const COMMANDS_CLASS = 'flex flex-col gap-[var(--spacing-system-mf)]';

const OS_ICONS: Partial<Record<DesktopOs, ComponentType<{ className?: string }>>> = {
  mac: AppleLogoIcon,
  windows: WindowsLogoGreyIcon,
};

/** A card's heading row: a small logo, the name, and one quiet line of detail at the far end. */
function CardHeader({
  icon: Icon,
  title,
  detail,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  detail?: string;
}) {
  return (
    <div className={CARD_HEADER_CLASS}>
      {Icon && <Icon className="h-6 w-6 shrink-0 text-ods-text-secondary" />}
      <h3 className="m-0 text-ods-text-primary text-h3">{title}</h3>
      {detail && <p className="m-0 ml-auto text-right text-ods-text-secondary text-h6">{detail}</p>}
    </div>
  );
}

interface SystemRows {
  os: DesktopOs;
  installers: AppDownload[];
  commands: AppDownload[];
}

/**
 * The rows per system, in the order they arrived. The page adapts to what the
 * deployment names: a system is offered when it has an installer OR a package
 * manager command, and a system with neither has no card at all.
 */
function rowsBySystem(downloads: readonly AppDownload[]): SystemRows[] {
  return DESKTOP_OSES.map(os => ({
    os,
    installers: downloads.filter(d => d.os === os && d.kind === 'binary' && d.url),
    commands: downloads.filter(d => d.os === os && d.kind === 'command' && d.command),
  })).filter(system => system.installers.length > 0 || system.commands.length > 0);
}

function installerLabel(download: AppDownload, siblings: number): string {
  if (download.label) return download.label;
  const label = `Download for ${DESKTOP_OS_LABELS[download.os]}`;
  const architecture = download.architecture ? DOWNLOAD_ARCHITECTURE_LABELS[download.architecture] : null;
  // One installer for a system needs no qualifier; two are told apart by their architecture.
  return siblings > 1 && architecture ? `${label} (${architecture})` : label;
}

/** One system's card: its logo and name, its installers side by side, then each package manager as one line. */
function SystemCard({
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
  const requirements = [...new Set(system.installers.map(d => d.minOsLabel).filter((l): l is string => !!l))];
  const report = (action: DownloadActionEvent['action'], row: AppDownload) =>
    onDownloadAction?.({ action, id: row.id, os: row.os, architecture: row.architecture });
  return (
    <div className={CARD_CLASS}>
      <CardHeader
        icon={OS_ICONS[system.os]}
        title={DESKTOP_OS_LABELS[system.os]}
        detail={requirements.length > 0 ? `Requires ${requirements.join(' or ')}` : undefined}
      />
      {system.installers.length > 0 && (
        <div className={BUTTONS_CLASS}>
          {system.installers.map((download, index) => (
            <Button
              key={download.id}
              variant={index === 0 ? 'accent' : 'outline'}
              href={download.url ?? undefined}
              download
              leftIcon={<Download01Icon className="h-5 w-5" />}
              onClick={() => report('installer', download)}
            >
              {installerLabel(download, system.installers.length)}
            </Button>
          ))}
        </div>
      )}
      {system.commands.length > 0 && (
        <div className={COMMANDS_CLASS}>
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
      )}
    </div>
  );
}

/** The closing card: one line of what the web offers, and the host's button at the far end. */
function WebCard({ web }: { web: DownloadAppsWebOption }) {
  return (
    <section
      aria-labelledby="download-web"
      className={cn(CARD_CLASS, 'content-md:flex-row content-md:items-center content-md:justify-between')}
    >
      <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
        <h2 id="download-web" className="m-0 text-ods-text-primary text-h3">
          {web.title}
        </h2>
        <p className="m-0 text-ods-text-secondary text-h4">{web.description}</p>
      </div>
      <div className="shrink-0">{web.action}</div>
    </section>
  );
}

/** A section's cards while the server's answer loads: the same grid and card frame, a button's box in each. */
function CardsSkeleton({ label }: { label: string }) {
  return (
    <div className={CARDS_GRID_CLASS} aria-busy="true" aria-label={label}>
      {[0, 1].map(card => (
        <div key={card} className={CARD_CLASS}>
          <UnifiedSkeleton className="h-6 w-32 rounded" />
          <UnifiedSkeleton className="h-12 w-56 rounded-md" />
          <UnifiedSkeleton className="h-14 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={SECTION_CLASS}>
      <h2 id={id} className="m-0 text-ods-text-primary text-h2">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Which devices the store card names: only the stores the server has a listing for. */
function storeCardTitle(links: MobileAppLinks): string {
  if (links.appStoreUrl && links.googlePlayUrl) return 'iPhone, iPad and Android';
  return links.appStoreUrl ? 'iPhone and iPad' : 'Android';
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
  web,
}: DownloadAppsPageProps) {
  const { data, isLoading, error, reload } = useDownloads({ endpoint, initialData });
  // The page adapts to the server's answer: a section exists only for what it names.
  const systems = showDesktop && data ? rowsBySystem(data.desktop) : [];
  const mobile = data?.mobile ?? null;
  const hasMobile = !!mobile && (!!mobile.appStoreUrl || !!mobile.googlePlayUrl);
  // Until the answer lands, a host that offers the desktop app is titled for it.
  const offersDesktop = showDesktop && (!data || systems.length > 0);

  let body: ReactNode;
  if (error && !data) {
    body = <LoadError message="Could not load the downloads" onRetry={reload} />;
  } else if (!data) {
    body = isLoading ? (
      <>
        {showDesktop && (
          <Section id="download-desktop" title="Desktop app">
            <CardsSkeleton label="Loading the installers" />
          </Section>
        )}
        <Section id="download-mobile" title="Mobile app">
          <CardsSkeleton label="Loading the mobile app" />
        </Section>
      </>
    ) : null;
  } else {
    body = (
      <>
        {systems.length > 0 && (
          <Section id="download-desktop" title="Desktop app">
            <div className={cardsGridClass(systems.length)}>
              {systems.map(system => (
                <SystemCard key={system.os} system={system} onDownloadAction={onDownloadAction} />
              ))}
            </div>
          </Section>
        )}

        {mobile && hasMobile && (
          <Section id="download-mobile" title="Mobile app">
            <div className={cardsGridClass(mobile.install ? 2 : 1)}>
              <div className={CARD_CLASS}>
                <CardHeader title={storeCardTitle(mobile)} />
                <p className="m-0 text-ods-text-secondary text-h4">Get alerts and respond to tickets on the go.</p>
                <StoreBadgeLinks
                  appStoreUrl={mobile.appStoreUrl}
                  googlePlayUrl={mobile.googlePlayUrl}
                  openInNewTab={openStoresInNewTab}
                />
              </div>
              {mobile.install && (
                <div
                  className={cn(CARD_CLASS, 'content-md:flex-row content-md:items-center content-md:justify-between')}
                >
                  <div className="flex flex-col gap-[var(--spacing-system-sf)]">
                    <CardHeader title="Scan with your phone" />
                    <p className="m-0 text-ods-text-secondary text-h4">
                      Point your camera at the code, or open {printableUrl(mobile.install.url)} on your phone.
                    </p>
                  </div>
                  {/* The plate is light on purpose: a QR code is read dark on light. */}
                  <div className="w-fit shrink-0 rounded-md bg-ods-bg-inverted p-[var(--spacing-system-sf)]">
                    <MobileAppQr install={mobile.install} className="h-[120px] w-[120px]" />
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}
      </>
    );
  }

  return (
    <DownloadAppsChrome
      shell={shell}
      backButton={backButton}
      title={title ?? (offersDesktop ? DOWNLOADS_TITLE : DOWNLOADS_MOBILE_TITLE)}
      subtitle={subtitle ?? (offersDesktop ? DOWNLOADS_TAGLINE : DOWNLOADS_MOBILE_TAGLINE)}
    >
      <div className={SECTIONS_CLASS}>
        {body}
        {web && <WebCard web={web} />}
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
