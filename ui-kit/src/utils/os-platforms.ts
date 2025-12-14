import type { ComponentType } from 'react';
import { WindowsIcon, LinuxIcon, MacOSIcon } from '../components/icons';

// OS-level platforms (Windows, Linux, MacOS)

export type OSPlatformId = 'windows' | 'linux' | 'darwin';

export interface OSPlatformOption {
  id: OSPlatformId;
  name: string;
  icon: ComponentType<any>;
}

export const OS_PLATFORMS: OSPlatformOption[] = [
  { id: 'windows', name: 'Windows', icon: WindowsIcon },
  { id: 'linux', name: 'Linux', icon: LinuxIcon },
  { id: 'darwin', name: 'MacOS', icon: MacOSIcon }
];

export const DEFAULT_OS_PLATFORM: OSPlatformId = 'windows';


