import type { MouseEvent } from 'react';

/**
 * A click handler that opens `href` in a new tab and does nothing else: the
 * "open in new tab" cell of a table whose rows are links themselves.
 */
export function openInNewTab(href: string) {
  return (event: MouseEvent) => {
    event.preventDefault();
    window.open(href, '_blank', 'noopener,noreferrer');
  };
}
