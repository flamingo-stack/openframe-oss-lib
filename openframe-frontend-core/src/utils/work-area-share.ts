/**
 * The work area's chat-column share before paint (`AppLayoutWorkArea`). Server-safe (no JSX,
 * no React, no contexts): a host's server root layout emits the seed script below in `<head>`.
 */

/**
 * The chat column's share of the row, as a CSS custom property on `<html>`: what the split
 * draws before it has measured the row (the server's markup, the first paint). The stored
 * share (`storageKey`) is read only once hydrated, so without it the first paint drew the
 * divider in the middle and then moved it to where the user had left it. A host that keeps
 * the share seeds it from storage before paint with {@link workAreaShareSeedScript}.
 */
export const WORK_AREA_SHARE_CSS_VAR = '--work-area-chat-share';

/**
 * A script for the document's `<head>` that sets {@link WORK_AREA_SHARE_CSS_VAR} from the share
 * `AppLayoutWorkArea` stored under `storageKey` (`{ share }`, JSON), before the first paint.
 * Nothing is set when storage is blocked or holds no valid share: the split then starts in the
 * middle, as it does after hydration. One share per document: a page with two work areas seeds
 * neither.
 */
export function workAreaShareSeedScript(storageKey: string): string {
  return `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}));if(s&&typeof s.share==='number'&&isFinite(s.share)&&s.share>0&&s.share<1){document.documentElement.style.setProperty('${WORK_AREA_SHARE_CSS_VAR}',String(s.share));}}catch(e){}})();`;
}
