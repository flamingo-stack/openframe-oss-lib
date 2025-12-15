import React from 'react';
import {
  Megaphone,
  Bell,
  Info,
  Star,
  Rocket,
  Package,
} from 'lucide-react';
import { OpenFrameLogo } from './openframe-logo';
import { OpenmspLogo } from './openmsp-logo';
import { FlamingoLogo } from './flamingo-logo';

/**
 * Returns a JSX element for a known icon name, spreading any extra props.
 * Falls back to Megaphone if the name is not recognised.
 */
export function renderSvgIcon(
  name: string,
  props: React.SVGProps<SVGSVGElement | SVGElement> = {}
): React.ReactElement {
  const map: Record<string, (p: any) => React.ReactElement> = {
    megaphone:   (p) => <Megaphone {...p} />,
    bell:        (p) => <Bell {...p} />,
    info:        (p) => <Info {...p} />,
    star:        (p) => <Star {...p} />,
    rocket:      (p) => <Rocket {...p} />,
    package:     (p) => <Package {...p} />,
    'openframe-logo': (p) => <OpenFrameLogo {...p} />,
    'openmsp-logo':   (p) => <OpenmspLogo {...p} />,
    'flamingo': (p)=> <FlamingoLogo {...p} />,
  };

  const renderer = map[name] || map['megaphone'];
  return renderer(props);
} 