import type { MobileAppInstallLink } from '../../types/downloads';
import { cn } from '../../utils/cn';

export interface MobileAppQrProps {
  /** The server's install link: the address and the artwork that encodes it. */
  install: MobileAppInstallLink;
  /** Sizes the code; the caller owns its footprint. */
  className?: string;
}

/**
 * The install QR code, drawn inline so the modules take their colour from the
 * surface they sit on. The artwork and the address it encodes are the server's
 * (`MobileAppInstallLink`): this component holds neither.
 *
 * Dark modules, and the caller supplies a light plate. Decoders binarize the
 * image and expect dark-on-light; inverting that is one of the two things they
 * reliably fail on. The other is a missing quiet zone, which is why the server
 * bakes the margin into the viewBox: keep it even when the plate is larger.
 *
 * That polarity holds only under the dark theme, where `text-ods-bg` is the dark
 * value and `bg-ods-bg-inverted` the light one; both flip under `.theme-light`.
 * Do not render this inside a light-theme scope: an inverted code is silently
 * unscannable rather than visibly broken.
 */
export function MobileAppQr({ install, className }: MobileAppQrProps) {
  return (
    <svg
      viewBox={`0 0 ${install.qrViewBoxSize} ${install.qrViewBoxSize}`}
      fill="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${install.url}`}
      className={cn('h-[120px] w-[120px] text-ods-bg', className)}
    >
      <path stroke="currentColor" d={install.qrPath} />
    </svg>
  );
}
