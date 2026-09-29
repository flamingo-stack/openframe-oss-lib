import type { FC, ReactNode } from 'react';
import { type ToolType, ToolTypeValues } from '../types/tool.types';
import {
  OsqueryLogoGreyIcon,
  MeshcentralLogoGreyIcon,
  FleetMdmLogoGreyIcon,
  AuthentikLogoGreyIcon,
  MicrosoftLogoGreyIcon,
  OpenframeLogoGreyIcon,
  GoogleLogoGreyIcon,
} from './icons-v2-generated';

type ToolIconRenderer = (size: number, className?: string) => ReactNode;

// Every mark is the grey (`currentColor`) cut of the brand logo, the OpenFrame one included, so a
// row of tool icons reads as one set and takes the text colour of wherever it sits.
const renderOpenFrameLogo: ToolIconRenderer = (size, className) => (
  <OpenframeLogoGreyIcon size={size} className={className} />
);

const toolIconMap: Record<ToolType, ToolIconRenderer> = {
  [ToolTypeValues.FLEET_MDM]: (size, className) => <FleetMdmLogoGreyIcon size={size} className={className} />,
  [ToolTypeValues.MESHCENTRAL]: (size, className) => <MeshcentralLogoGreyIcon size={size} className={className} />,
  [ToolTypeValues.OPENFRAME]: renderOpenFrameLogo,
  [ToolTypeValues.OPENFRAME_CHAT]: renderOpenFrameLogo,
  [ToolTypeValues.OPENFRAME_CLIENT]: renderOpenFrameLogo,
  [ToolTypeValues.OPENFRAME_RMM]: renderOpenFrameLogo,
  [ToolTypeValues.AUTHENTIK]: (size, className) => <AuthentikLogoGreyIcon size={size} className={className} />,
  [ToolTypeValues.OSQUERY]: (size, className) => <OsqueryLogoGreyIcon size={size} className={className} />,
  [ToolTypeValues.SYSTEM]: () => null,
  [ToolTypeValues.MICROSOFT_365]: (size, className) => <MicrosoftLogoGreyIcon size={size} className={className} />,
  [ToolTypeValues.GOOGLE_WORKSPACE]: (size, className) => <GoogleLogoGreyIcon size={size} className={className} />,
};

export interface ToolIconProps {
  toolType: ToolType;
  size?: number;
  className?: string;
}

export const ToolIcon: FC<ToolIconProps> = ({ toolType, size = 16, className }) => (
  <>{toolIconMap[toolType]?.(size, className) ?? null}</>
);

ToolIcon.displayName = 'ToolIcon';
