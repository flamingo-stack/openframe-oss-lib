/** A doc's tree path in the form a route may hold: alphanumerics, slash, dash, dot and underscore, everything else
 *  stripped. Defends against a hostile row holding a query string or an injection. */
export function sanitizeDocPath(path: string): string {
  return (path || '').replace(/[^a-zA-Z0-9/_\-.]/g, '');
}
