'use client';

import type { ReactNode } from 'react';
import { VolumeUpIcon } from '../../icons-v2-generated/audio-and-visual/volume-up-icon';
import { ChromeIcon } from '../../icons-v2-generated/brand-logos/chrome-icon';
import { WindowsIcon } from '../../icons-v2-generated/brand-logos/windows-icon';
import { PrinterIcon } from '../../icons-v2-generated/devices/printer-icon';
import { WifiIcon } from '../../icons-v2-generated/devices/wifi-icon';
import { FolderIcon } from '../../icons-v2-generated/documents/folder-icon';
import { SearchIcon } from '../../icons-v2-generated/interface/search-icon';
import { TrashIcon } from '../../icons-v2-generated/interface/trash-icon';
import { StopIcon } from '../../icons-v2-generated/media-playback/stop-icon';
import { CheckCircleIcon } from '../../icons-v2-generated/signs-and-symbols/check-circle-icon';
import { MinusIcon } from '../../icons-v2-generated/signs-and-symbols/minus-icon';
import { XmarkIcon } from '../../icons-v2-generated/signs-and-symbols/xmark-icon';
import type { RemoteSessionFixture } from '../fixtures/remote-session';

function DesktopShortcut({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex w-20 flex-col items-center gap-[var(--spacing-system-xxs)]">
      <span className="flex size-10 items-center justify-center rounded-md bg-ods-card/70 text-ods-text-primary">
        {icon}
      </span>
      <span className="w-full truncate text-center text-ods-text-primary text-h6">{label}</span>
    </div>
  );
}

function ServiceRow({ name, state }: { name: string; state: string }) {
  return (
    <div className="flex items-center gap-[var(--spacing-system-xs)] py-[var(--spacing-system-xs)]">
      <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-ods-success" />
      <span className="min-w-0 flex-1 truncate text-ods-text-primary text-h4">{name}</span>
      <span className="flex-shrink-0 text-ods-text-secondary text-h6">{state}</span>
    </div>
  );
}

function TaskbarApp({ icon, active = false }: { icon: ReactNode; active?: boolean }) {
  return (
    <span
      className={`flex size-8 items-center justify-center rounded-md text-ods-text-primary ${
        active ? 'border-b-2 border-ods-accent bg-ods-bg-surface' : ''
      }`}
    >
      {icon}
    </span>
  );
}

/**
 * What the stream shows: the device's own desktop, filling the screen box the
 * way a live session does. A wallpaper with its shortcuts, the printer's
 * settings window open after the spooler was restarted, and the task bar. A
 * drawing, standing in for the host's live canvas.
 */
export function RemoteDesktopPicture({ desktop }: { desktop: RemoteSessionFixture['desktop'] }) {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-ods-flamingo-cyan-secondary via-ods-bg-surface to-ods-flamingo-pink-secondary">
      <div className="relative min-h-0 flex-1">
        {/* A narrow box shows the window alone: the shortcuts would leave it no room. */}
        <div className="absolute left-[var(--spacing-system-sf)] top-[var(--spacing-system-sf)] hidden flex-col gap-[var(--spacing-system-sf)] content-md:flex">
          <DesktopShortcut icon={<TrashIcon className="h-5 w-5" />} label="Recycle Bin" />
          <DesktopShortcut icon={<FolderIcon className="h-5 w-5" />} label="Scans" />
          <DesktopShortcut icon={<ChromeIcon className="h-5 w-5" />} label="Chrome" />
        </div>

        <div className="absolute bottom-[var(--spacing-system-mf)] left-[var(--spacing-system-mf)] right-[var(--spacing-system-mf)] top-[var(--spacing-system-mf)] flex flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card shadow-lg content-md:left-28">
          <div className="flex flex-shrink-0 items-center gap-[var(--spacing-system-xs)] border-b border-ods-border bg-ods-bg-surface px-[var(--spacing-system-sf)] py-[var(--spacing-system-xs)]">
            <PrinterIcon className="h-4 w-4 flex-shrink-0 text-ods-text-secondary" />
            <span className="min-w-0 flex-1 truncate text-ods-text-primary text-h6">Printers &amp; scanners</span>
            <MinusIcon className="h-4 w-4 flex-shrink-0 text-ods-text-secondary" />
            <StopIcon className="h-3 w-3 flex-shrink-0 text-ods-text-secondary" />
            <XmarkIcon className="h-4 w-4 flex-shrink-0 text-ods-text-secondary" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-sf)] p-[var(--spacing-system-mf)]">
            <div className="flex items-center gap-[var(--spacing-system-sf)]">
              <span className="flex size-12 flex-shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-bg text-ods-text-primary">
                <PrinterIcon className="h-6 w-6" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-ods-text-primary text-h3">{desktop.printer}</span>
                <span className="truncate text-ods-text-secondary text-h6">Default printer</span>
              </div>
              <span className="flex-shrink-0 rounded-md bg-ods-success-secondary px-[var(--spacing-system-xs)] py-[var(--spacing-system-xxs)] text-ods-success text-h5">
                Ready
              </span>
            </div>
            <div className="flex flex-col divide-y divide-ods-border border-t border-ods-border">
              <ServiceRow name="Print Spooler" state={`Restarted ${desktop.clock}`} />
              <ServiceRow name="Print queue" state="0 documents waiting" />
              <ServiceRow name="Test page" state="Printed" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-[var(--spacing-system-xs)] border-t border-ods-border bg-ods-card px-[var(--spacing-system-sf)] py-[var(--spacing-system-xxs)]">
        <TaskbarApp icon={<WindowsIcon className="h-4 w-4" />} />
        <span className="hidden h-8 w-40 items-center gap-[var(--spacing-system-xs)] rounded-md bg-ods-bg-surface px-[var(--spacing-system-xs)] text-ods-text-secondary text-h6 content-md:flex">
          <SearchIcon className="h-4 w-4 flex-shrink-0" />
          Search
        </span>
        <TaskbarApp icon={<FolderIcon className="h-4 w-4" />} />
        <TaskbarApp icon={<ChromeIcon className="h-4 w-4" />} />
        <TaskbarApp icon={<PrinterIcon className="h-4 w-4" />} active />
        <span className="ml-auto flex flex-shrink-0 items-center gap-[var(--spacing-system-xs)] text-ods-text-primary">
          <WifiIcon className="h-4 w-4" />
          <VolumeUpIcon className="h-4 w-4" />
          <span className="flex flex-col items-end leading-tight text-h6">
            <span>{desktop.clock}</span>
            <span className="text-ods-text-secondary">{desktop.date}</span>
          </span>
        </span>
      </div>
    </div>
  );
}
