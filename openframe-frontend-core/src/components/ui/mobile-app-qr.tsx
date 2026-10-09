import type { MobileAppInstallLink } from '../../types/downloads';
import { cn } from '../../utils/cn';

export interface MobileAppQrProps {
  /** The server's install link: the address and the artwork that encodes it. */
  install: MobileAppInstallLink;
  /** Sizes the code; the caller owns its footprint. */
  className?: string;
}

/**
 * The install QR code, drawn inline: the modules are the ODS accent colour and
 * the background is transparent, so the code sits directly on whatever surface
 * it is placed on. The artwork and the address it encodes are the server's
 * (`MobileAppInstallLink`): this component holds neither.
 *
 * On a dark surface that is a light-on-dark code. Phone cameras read both
 * polarities; what they need is contrast between the accent and the surface, and
 * the quiet zone, which the server bakes into the viewBox as a transparent
 * margin. Place it on a plain surface (a card, the page), never over an image
 * or a surface close to the accent in brightness.
 */
export function MobileAppQr({ install, className }: MobileAppQrProps) {
  return (
    <svg
      viewBox={`0 0 ${install.qrViewBoxSize} ${install.qrViewBoxSize}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${install.url}`}
      className={cn('h-[120px] w-[120px] text-ods-accent', className)}
    >
      <path fill="currentColor" d={install.qrPath} />
    </svg>
  );
}
