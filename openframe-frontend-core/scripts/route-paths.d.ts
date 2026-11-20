/** Whether a file name is a Next.js page (`page.tsx`, `page.js`, …). */
export declare function isPageFile(name: string): boolean;
/** Whether a folder is private (`_lib`): Next routes nothing under it. */
export declare function isPrivateSegment(name: string): boolean;
/**
 * The paths a route folder answers, from its folder names under the app directory: a sample path with each dynamic
 * segment filled, then (for a dynamic route) the static part before its first dynamic segment. Route groups and
 * parallel slots spell nothing.
 */
export declare function routeSegmentPaths(segments: readonly string[]): string[];
