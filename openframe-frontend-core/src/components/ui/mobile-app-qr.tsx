import { cn } from '../../utils/cn';
import { MOBILE_APP_INSTALL_URL } from '../../utils/mobile-app';

export interface MobileAppQrProps {
  /** Sizes the code; the caller owns its footprint. */
  className?: string;
}

/**
 * The install QR code, drawn inline rather than loaded from `/public` so the
 * modules take their colour from the surface they sit on.
 *
 * Dark modules, and the caller supplies a light plate. Decoders binarize the
 * image and expect dark-on-light; inverting that is one of the two things they
 * reliably fail on. The other is a missing quiet zone, which is why the 4-module
 * margin is baked into the viewBox — keep it even when the plate is larger.
 *
 * That polarity holds only under the dark theme, where `text-ods-bg` is the dark
 * value and `bg-ods-bg-inverted` the light one; both flip under `.theme-light`.
 * Do not render this inside a light-theme scope: an inverted code is silently
 * unscannable rather than visibly broken.
 *
 * Encodes {@link MOBILE_APP_INSTALL_URL} at version 3, ECC level M. The path
 * data is committed, so it changes WITH that URL: with the `qrcode` package,
 * `QRCode.create(url, { errorCorrectionLevel: 'M' })` gives the modules; each
 * row is one `M{x+4} {y+4}.5h{run}` followed by `m{gap} 0h{run}` per further
 * run (the 4 is the quiet zone), and the viewBox side is `size + 8`.
 */
export function MobileAppQr({ className }: MobileAppQrProps) {
  return (
    <svg
      viewBox="0 0 37 37"
      fill="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${MOBILE_APP_INSTALL_URL}`}
      className={cn('h-[120px] w-[120px] text-ods-bg', className)}
    >
      <path
        stroke="currentColor"
        d="M4 4.5h7m2 0h2m2 0h1m2 0h1m2 0h2m1 0h7M4 5.5h1m5 0h1m2 0h2m2 0h3m6 0h1m5 0h1M4 6.5h1m1 0h3m1 0h1m1 0h3m1 0h1m1 0h3m2 0h1m2 0h1m1 0h3m1 0h1M4 7.5h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h6m2 0h1m1 0h1m1 0h3m1 0h1M4 8.5h1m1 0h3m1 0h1m1 0h3m1 0h1m1 0h1m1 0h5m1 0h1m1 0h3m1 0h1M4 9.5h1m5 0h1m1 0h1m1 0h2m1 0h1m1 0h3m4 0h1m5 0h1M4 10.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M12 11.5h1m2 0h2m5 0h3M4 12.5h1m1 0h5m3 0h1m1 0h8m2 0h5M4 13.5h4m4 0h2m2 0h1m3 0h4m1 0h4m3 0h1M6 14.5h1m3 0h3m1 0h1m3 0h4m2 0h1M4 15.5h1m2 0h3m2 0h2m1 0h2m1 0h1m1 0h1m2 0h5m1 0h1m1 0h1M4 16.5h1m4 0h2m1 0h2m1 0h1m1 0h1m2 0h2m1 0h1m5 0h2M16 17.5h3m3 0h5m1 0h1m3 0h1M5 18.5h1m3 0h2m1 0h1m5 0h2m4 0h1m1 0h2m1 0h2M4 19.5h6m1 0h1m3 0h1m2 0h3m1 0h4m1 0h2m2 0h1M8 20.5h1m1 0h1m2 0h2m1 0h2m1 0h1m1 0h1m5 0h1m1 0h2M4 21.5h1m1 0h2m7 0h1m2 0h1m1 0h9m1 0h1m1 0h1M4 22.5h1m3 0h3m2 0h1m1 0h2m2 0h3m3 0h1m1 0h1m2 0h1M4 23.5h1m6 0h4m3 0h2m3 0h2m2 0h2m2 0h1M4 24.5h1m2 0h4m4 0h1m3 0h1m1 0h1m1 0h6m1 0h3M12 25.5h6m2 0h1m3 0h1m3 0h5M4 26.5h7m3 0h8m1 0h2m1 0h1m1 0h3M4 27.5h1m5 0h1m1 0h2m1 0h3m2 0h1m2 0h2m3 0h1M4 28.5h1m1 0h3m1 0h1m1 0h2m2 0h1m1 0h1m2 0h1m2 0h5m1 0h3M4 29.5h1m1 0h3m1 0h1m1 0h2m1 0h2m3 0h4m3 0h1m1 0h4M4 30.5h1m1 0h3m1 0h1m1 0h1m3 0h4m1 0h1m2 0h8M4 31.5h1m5 0h1m4 0h1m1 0h1m1 0h2m1 0h1m1 0h1m1 0h2m1 0h1m1 0h1M4 32.5h7m1 0h1m2 0h2m4 0h1m1 0h1m3 0h4"
      />
    </svg>
  );
}
