import type { SVGProps } from "react";
export interface FleetMdmLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FleetMdmLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FleetMdmLogoIconProps) {
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
        d="M4.512 7a2.506 2.506 0 0 0 2.512-2.5C7.024 3.12 5.9 2 4.512 2A2.506 2.506 0 0 0 2 4.5C2 5.88 3.125 7 4.512 7m7.536 0a2.506 2.506 0 0 0 2.512-2.5c0-1.38-1.124-2.5-2.512-2.5a2.506 2.506 0 0 0-2.512 2.5c0 1.38 1.125 2.5 2.512 2.5m7.536 0a2.506 2.506 0 0 0 2.512-2.5c0-1.38-1.124-2.5-2.512-2.5a2.506 2.506 0 0 0-2.512 2.5c0 1.38 1.125 2.5 2.512 2.5M4.512 14.5A2.506 2.506 0 0 0 7.024 12c0-1.38-1.125-2.5-2.512-2.5A2.506 2.506 0 0 0 2 12c0 1.38 1.125 2.5 2.512 2.5m7.536 0A2.506 2.506 0 0 0 14.56 12c0-1.38-1.124-2.5-2.512-2.5A2.506 2.506 0 0 0 9.536 12c0 1.38 1.125 2.5 2.512 2.5M4.512 22a2.506 2.506 0 0 0 2.512-2.5c0-1.38-1.125-2.5-2.512-2.5A2.506 2.506 0 0 0 2 19.5C2 20.88 3.125 22 4.512 22"
      />
    </svg>
  );
}
