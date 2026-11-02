/**
 * The names `next-styles build` and `RouteStyles` agree on, stated once: the build writes them
 * (`./route-styles.cjs`, `./next-styles.cjs`) and the server and client parts read them
 * (`./route-styles-server.mjs`, `./route-styles-client.mjs`). A leaf with no imports, so the app's server and
 * browser bundles can carry it without reaching the build tool.
 */
module.exports = {
  /** Where `next-styles build` keeps the build's route sheets (the app's directory), and its files there. */
  STYLES_DIR: '.next-styles',
  BUILD_INFO: 'build.json',
  MANIFEST: 'manifest.json',
  /** What a prerendered page's route `<style>` holds until the build fills it with the route's rules. */
  PLACEHOLDER: '/*next-styles:route*/',
  /** What a page that carries the complete sheet (`RouteStyles complete`) holds until the build fills it. */
  COMPLETE_PLACEHOLDER: '/*next-styles:complete*/',
  /** The process-wide key the server part registers its resolver under for the client part's server render. */
  REGISTRY_KEY: 'flamingo.next-styles',
};
