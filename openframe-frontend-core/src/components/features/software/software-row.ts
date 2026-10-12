import type { SupportedPackageManager } from './package-managers';

/** A catalog package the user picked, kept whole so the row can show its description and version. */
export interface SelectedPackage {
  id: string;
  name: string;
  description: string | null;
  version: string | null;
  /** Homebrew only: a formula and a cask can share a name. */
  packageType: 'FORMULA' | 'CASK' | null;
}

/** One "Package Manager + Software Name" row of the form. */
export interface SoftwareRow {
  key: string;
  packageManager: SupportedPackageManager;
  pkg: SelectedPackage | null;
}

export function newSoftwareRow(key: string): SoftwareRow {
  return { key, packageManager: 'BREW', pkg: null };
}
