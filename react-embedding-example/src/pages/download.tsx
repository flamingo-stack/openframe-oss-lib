import { DownloadAppsPage } from '@flamingo-stack/openframe-frontend-core/components/help-center-pages'
import { EP } from '../config/endpoints'

/**
 * Download: config-only. `<DownloadAppsPage>` owns the chrome, self-fetches the
 * hub's public list of desktop installers and install commands through the
 * `/content` proxy, opens the visitor's own system, and draws the mobile app's
 * store badges and install QR code from the lib's own constants. This page
 * supplies only the **api route**.
 */
export function DownloadPage() {
  return <DownloadAppsPage endpoint={EP.downloads} />
}
