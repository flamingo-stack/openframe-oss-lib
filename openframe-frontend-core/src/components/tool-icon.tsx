import * as React from "react";
import { ToolType, ToolTypeValues } from "../types/tool.types";
import { OpenFrameLogo } from "./icons";
import {
	OsqueryLogoGreyIcon,
	MeshcentralLogoGreyIcon,
	FleetMdmLogoGreyIcon,
	AuthentikLogoGreyIcon,
	PowershellLogoGreyIcon,
} from "./icons-v2-generated";

const renderOpenFrameLogo = (_size: number, className?: string) => (
	// eslint-disable-next-line deprecation/deprecation
	<OpenFrameLogo
		className={className ?? "h-4 w-auto"}
		lowerPathColor="var(--color-accent-primary)"
		upperPathColor="var(--color-text-primary)"
	/>
);

const toolIconMap: Record<ToolType, (size: number, className?: string) => React.ReactNode> = {
	[ToolTypeValues.FLEET_MDM]: (size, className) => <FleetMdmLogoGreyIcon size={size} className={className} />,
	[ToolTypeValues.MESHCENTRAL]: (size, className) => <MeshcentralLogoGreyIcon size={size} className={className} />,
	[ToolTypeValues.OPENFRAME]: renderOpenFrameLogo,
	[ToolTypeValues.OPENFRAME_CHAT]: renderOpenFrameLogo,
	[ToolTypeValues.OPENFRAME_CLIENT]: renderOpenFrameLogo,
	[ToolTypeValues.OPENFRAME_RMM]: renderOpenFrameLogo,
	[ToolTypeValues.AUTHENTIK]: (size, className) => <AuthentikLogoGreyIcon size={size} className={className} />,
	[ToolTypeValues.OSQUERY]: (size, className) => <OsqueryLogoGreyIcon size={size} className={className} />,
	[ToolTypeValues.SYSTEM]: () => null,
	[ToolTypeValues.POWERSHELL]: (size, className) => <PowershellLogoGreyIcon size={size} className={className} />,
};

export interface ToolIconProps {
	toolType: ToolType;
	size?: number;
	className?: string;
}

export const ToolIcon: React.FC<ToolIconProps> = ({ toolType, size = 16, className }) =>
	<>{toolIconMap[toolType]?.(size, className) ?? null}</>;

ToolIcon.displayName = "ToolIcon";
