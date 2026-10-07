import type { ComponentType } from 'react';
import { HomebrewLogoGreyIcon, WingetLogoGreyIcon } from '../../icons-v2-generated';

/**
 * The package managers the UI offers. Chocolatey is deliberately left out:
 * the backend still lists `CHOCO`, but the product ships Brew and WinGet only,
 * so no form offers it.
 */
export const PACKAGE_MANAGERS = ['BREW', 'WINGET'] as const;

export type SupportedPackageManager = (typeof PACKAGE_MANAGERS)[number];

export const PACKAGE_MANAGER_LABEL: Record<SupportedPackageManager, string> = {
  BREW: 'Brew',
  WINGET: 'WinGet',
};

/**
 * Each catalog's brand mark, in the grey (`currentColor`) cut the tool badges use,
 * so it takes whatever text colour the row it sits in gives it.
 */
export const PACKAGE_MANAGER_ICON: Record<
  SupportedPackageManager,
  ComponentType<{ size?: number; className?: string }>
> = {
  BREW: HomebrewLogoGreyIcon,
  WINGET: WingetLogoGreyIcon,
};

/** The OS each catalog installs on: what narrows the device picker. */
export const PACKAGE_MANAGER_OS: Record<SupportedPackageManager, 'MAC_OS' | 'WINDOWS'> = {
  BREW: 'MAC_OS',
  WINGET: 'WINDOWS',
};

/** A run's package manager as the UI names it; the raw value for one no form offers. */
export function packageManagerLabel(value: string): string {
  return value in PACKAGE_MANAGER_LABEL ? PACKAGE_MANAGER_LABEL[value as SupportedPackageManager] : value;
}

/** Where the inventory can find a title. */
export type SoftwareSourceKind = 'WINGET' | 'CHOCOLATEY' | 'BREW' | 'UNMANAGED';

/**
 * Where the inventory found a title. The catalogs the UI offers read as they do
 * in the forms; Chocolatey still gets a name, because the inventory reports what
 * a device has regardless of what the product installs.
 */
export const SOFTWARE_SOURCE_LABEL: Record<SoftwareSourceKind, string> = {
  BREW: PACKAGE_MANAGER_LABEL.BREW,
  WINGET: PACKAGE_MANAGER_LABEL.WINGET,
  CHOCOLATEY: 'Chocolatey',
  UNMANAGED: 'Unmanaged',
};
