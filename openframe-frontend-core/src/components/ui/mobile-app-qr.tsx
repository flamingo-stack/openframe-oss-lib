import { MOBILE_APP_QR_PATH, MOBILE_APP_QR_VIEWBOX_SIZE } from '../../assets/mobile-app-qr';
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
 * The artwork is the asset `MOBILE_APP_QR_PATH` (`assets/mobile-app-qr`), which
 * encodes {@link MOBILE_APP_INSTALL_URL}; the regeneration note lives there.
 */
export function MobileAppQr({ className }: MobileAppQrProps) {
  return (
    <svg
      viewBox={`0 0 ${MOBILE_APP_QR_VIEWBOX_SIZE} ${MOBILE_APP_QR_VIEWBOX_SIZE}`}
      fill="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${MOBILE_APP_INSTALL_URL}`}
      className={cn('h-[120px] w-[120px] text-ods-bg', className)}
    >
      <path stroke="currentColor" d={MOBILE_APP_QR_PATH} />
    </svg>
  );
}
