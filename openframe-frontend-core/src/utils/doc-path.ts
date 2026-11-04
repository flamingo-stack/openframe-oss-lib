/** A doc's tree path in the form a route may hold: alphanumerics, slash, dash, dot and underscore, everything else
 *  stripped, and no `.`, `..` or empty segment, so the path stays inside the docs tree. Defends against a hostile row
 *  holding a query string, an injection or a path that climbs out of the tree. */
export function sanitizeDocPath(path: string): string {
  return (path || '')
    .replace(/[^a-zA-Z0-9/_\-.]/g, '')
    .split('/')
    .filter(segment => segment !== '' && segment !== '.' && segment !== '..')
    .join('/');
}
