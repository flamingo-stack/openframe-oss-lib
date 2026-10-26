import type { ComponentType, SVGProps } from 'react';
import { LinuxIcon } from '../components/icons-v2-generated/brand-logos/linux-icon';
import { MacosIcon } from '../components/icons-v2-generated/brand-logos/macos-icon';
import { WindowsClassicIcon } from '../components/icons-v2-generated/brand-logos/windows-classic-icon';

// OS-level platforms (Windows, Linux, MacOS)

export type OSPlatformId = 'windows' | 'linux' | 'darwin';

export interface OSPlatformOption {
  id: OSPlatformId;
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const OS_PLATFORMS: OSPlatformOption[] = [
  { id: 'windows', name: 'Windows', icon: WindowsClassicIcon },
  { id: 'linux', name: 'Linux', icon: LinuxIcon },
  { id: 'darwin', name: 'MacOS', icon: MacosIcon },
];

export const DEFAULT_OS_PLATFORM: OSPlatformId = 'windows';
