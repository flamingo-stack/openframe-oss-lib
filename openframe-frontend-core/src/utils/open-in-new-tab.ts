import type { MouseEvent } from 'react';
import { executeNewTabNavigation } from '../components/chat/utils/execute-navigation';

/**
 * A click handler that opens `href` in a new tab and does nothing else: the
 * "open in new tab" cell of a table whose rows are links themselves. Opened the
 * one way the lib opens a tab (`executeNewTabNavigation`).
 */
export function openInNewTab(href: string) {
  return (event: MouseEvent) => {
    event.preventDefault();
    executeNewTabNavigation({ runtime: null, href });
  };
}
