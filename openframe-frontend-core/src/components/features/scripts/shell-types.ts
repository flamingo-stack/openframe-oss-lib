import { type ShellTypeDefinition, ShellTypeValues } from '../../../types/shell.types';
import { PowershellLogoGreyIcon } from '../../icons-v2-generated/brand-logos/powershell-logo-grey-icon';
import { TerminalIcon } from '../../icons-v2-generated/coding/terminal-icon';
import { TerminalSquareIcon } from '../../icons-v2-generated/coding/terminal-square-icon';

/**
 * The shells the product's Scripts pages offer, as they are shown there: the
 * `CMD` label (not "Batch"), the v2 icons and a grey PowerShell glyph. The
 * wider `SHELL_TYPES` list of `types/shell.types` is every shell the agent can
 * run; this one is what a person picks from.
 */
export const SCRIPT_SHELL_TYPES: ShellTypeDefinition[] = [
  { id: ShellTypeValues.POWERSHELL, label: 'PowerShell', value: 'powershell', icon: PowershellLogoGreyIcon },
  { id: ShellTypeValues.CMD, label: 'CMD', value: 'cmd', icon: TerminalSquareIcon },
  { id: ShellTypeValues.BASH, label: 'Bash', value: 'bash', icon: TerminalIcon },
];

/** The shell with this lowercase id (`'cmd'`). */
export function scriptShellType(value: string): ShellTypeDefinition | undefined {
  return SCRIPT_SHELL_TYPES.find(shell => shell.value === value);
}

/** The label of a lowercase shell id, else the id itself. */
export function scriptShellLabel(value: string): string {
  return scriptShellType(value)?.label ?? value;
}
