import { Megaphone, Bell, Info, Star, Rocket, Package, Globe } from 'lucide-react';
import type React from 'react';
import { FlamingoLogo } from './flamingo-logo';
import { MiamiCyberGangLogoFaceOnly } from './miami-cyber-gang-logo-face-only';
import { OpenFrameLogo } from './openframe-logo';
import { OpenmspLogo } from './openmsp-logo';

/**
 * Returns a JSX element for a known icon name, spreading any extra props.
 * Falls back to Megaphone if the name is not recognised.
 */
/** @deprecated Use icons from icons-v2-generated instead. */
export function renderSvgIcon(
  name: string,
  props: React.SVGProps<SVGSVGElement | SVGElement> = {},
): React.ReactElement {
  // `ref` is omitted: the incoming props are typed for `SVGSVGElement |
  // SVGElement`, and a ref to that union does not fit the concrete
  // `Ref<SVGSVGElement>` each glyph below declares.
  type Renderer = (p: Omit<React.SVGProps<SVGSVGElement>, 'ref'>) => React.ReactElement;
  const map: Record<string, Renderer> = {
    // Lucide Icons
    megaphone: p => <Megaphone {...p} />,
    bell: p => <Bell {...p} />,
    info: p => <Info {...p} />,
    star: p => <Star {...p} />,
    rocket: p => <Rocket {...p} />,
    package: p => <Package {...p} />,
    globe: p => <Globe {...p} />,

    // Platform Logos
    'openframe-logo': p => <OpenFrameLogo {...p} />,
    'openmsp-logo': p => <OpenmspLogo {...p} color="#f1f1f1" />,
    flamingo: p => <FlamingoLogo {...p} />,
    'flamingo-logo': p => <FlamingoLogo {...p} />,
    'tmcg-logo': p => <MiamiCyberGangLogoFaceOnly size={24} {...p} />,
    universal: p => <Globe {...p} />,
  };

  const renderer = map[name] || map.megaphone;
  return renderer(props);
}
