import type { SVGProps } from "react";
export interface HubspotLogoGreyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HubspotLogoGreyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HubspotLogoGreyIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M16.588 8.585V6.204A1.83 1.83 0 0 0 17.64 4.55v-.055a1.83 1.83 0 0 0-1.824-1.834h-.054a1.83 1.83 0 0 0-1.824 1.834v.055a1.84 1.84 0 0 0 1.051 1.653v2.381c-.9.139-1.747.514-2.456 1.088L6.037 4.585q.069-.253.073-.515c.001-.408-.119-.808-.344-1.148a2.06 2.06 0 0 0-2.108-.883c-.4.08-.766.275-1.054.564a2.07 2.07 0 0 0-.449 2.251c.155.378.418.701.756.929.338.227.735.35 1.141.35a2 2 0 0 0 1.013-.277l6.396 5.005a5.23 5.23 0 0 0 .08 5.868l-1.946 1.957a1.7 1.7 0 0 0-.486-.08c-.932 0-1.687.76-1.687 1.698 0 .936.756 1.696 1.688 1.696s1.687-.759 1.688-1.696a1.7 1.7 0 0 0-.08-.488l1.925-1.936a5.17 5.17 0 0 0 5.922.287 5.23 5.23 0 0 0 2.327-5.482 5.2 5.2 0 0 0-4.304-4.1m-.797 7.833a2.65 2.65 0 0 1-1.93-.758 2.68 2.68 0 0 1-.805-1.918 2.7 2.7 0 0 1 .806-1.919 2.66 2.66 0 0 1 1.929-.758 2.67 2.67 0 0 1 2.57 2.675 2.67 2.67 0 0 1-2.568 2.677"
      />
    </svg>
  );
}
