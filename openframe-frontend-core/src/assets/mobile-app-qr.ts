/**
 * The install QR code's artwork: the modules of `MOBILE_APP_INSTALL_URL`
 * (`utils/mobile-app`) at version 3, ECC level M, as one SVG path. Packaged with
 * the library like the other assets, so every consumer draws the same code with
 * no host-asset serving. `MobileAppQr` (components/ui) is the component that
 * renders it.
 *
 * It changes WITH that URL. To regenerate: with the `qrcode` package,
 * `QRCode.create(url, { errorCorrectionLevel: 'M' })` gives the modules; each
 * row is one `M{x+4} {y+4}.5h{run}` followed by `m{gap} 0h{run}` per further
 * run (the 4 is the quiet zone), and the viewBox side is `size + 8`.
 */

/** The side of the artwork's square viewBox: 29 modules plus a 4-module quiet zone on each side. */
export const MOBILE_APP_QR_VIEWBOX_SIZE = 37;

/** The dark modules, as horizontal strokes one module tall (`stroke` draws them). */
export const MOBILE_APP_QR_PATH =
  'M4 4.5h7m2 0h2m2 0h1m2 0h1m2 0h2m1 0h7M4 5.5h1m5 0h1m2 0h2m2 0h3m6 0h1m5 0h1M4 6.5h1m1 0h3m1 0h1m1 0h3m1 0h1m1 0h3m2 0h1m2 0h1m1 0h3m1 0h1M4 7.5h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h6m2 0h1m1 0h1m1 0h3m1 0h1M4 8.5h1m1 0h3m1 0h1m1 0h3m1 0h1m1 0h1m1 0h5m1 0h1m1 0h3m1 0h1M4 9.5h1m5 0h1m1 0h1m1 0h2m1 0h1m1 0h3m4 0h1m5 0h1M4 10.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M12 11.5h1m2 0h2m5 0h3M4 12.5h1m1 0h5m3 0h1m1 0h8m2 0h5M4 13.5h4m4 0h2m2 0h1m3 0h4m1 0h4m3 0h1M6 14.5h1m3 0h3m1 0h1m3 0h4m2 0h1M4 15.5h1m2 0h3m2 0h2m1 0h2m1 0h1m1 0h1m2 0h5m1 0h1m1 0h1M4 16.5h1m4 0h2m1 0h2m1 0h1m1 0h1m2 0h2m1 0h1m5 0h2M16 17.5h3m3 0h5m1 0h1m3 0h1M5 18.5h1m3 0h2m1 0h1m5 0h2m4 0h1m1 0h2m1 0h2M4 19.5h6m1 0h1m3 0h1m2 0h3m1 0h4m1 0h2m2 0h1M8 20.5h1m1 0h1m2 0h2m1 0h2m1 0h1m1 0h1m5 0h1m1 0h2M4 21.5h1m1 0h2m7 0h1m2 0h1m1 0h9m1 0h1m1 0h1M4 22.5h1m3 0h3m2 0h1m1 0h2m2 0h3m3 0h1m1 0h1m2 0h1M4 23.5h1m6 0h4m3 0h2m3 0h2m2 0h2m2 0h1M4 24.5h1m2 0h4m4 0h1m3 0h1m1 0h1m1 0h6m1 0h3M12 25.5h6m2 0h1m3 0h1m3 0h5M4 26.5h7m3 0h8m1 0h2m1 0h1m1 0h3M4 27.5h1m5 0h1m1 0h2m1 0h3m2 0h1m2 0h2m3 0h1M4 28.5h1m1 0h3m1 0h1m1 0h2m2 0h1m1 0h1m2 0h1m2 0h5m1 0h3M4 29.5h1m1 0h3m1 0h1m1 0h2m1 0h2m3 0h4m3 0h1m1 0h4M4 30.5h1m1 0h3m1 0h1m1 0h1m3 0h4m1 0h1m2 0h8M4 31.5h1m5 0h1m4 0h1m1 0h1m1 0h2m1 0h1m1 0h1m1 0h2m1 0h1m1 0h1M4 32.5h7m1 0h1m2 0h2m4 0h1m1 0h1m3 0h4';
