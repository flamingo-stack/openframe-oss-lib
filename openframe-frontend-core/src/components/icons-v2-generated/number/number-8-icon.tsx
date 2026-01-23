import type { SVGProps } from "react";
export interface Number8IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Number8Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Number8IconProps) {
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
        d="M15.375 15.5a3.375 3.375 0 1 0-6.75 0 3.375 3.375 0 0 0 6.75 0m-.9-8A2.376 2.376 0 0 0 12.1 5.125h-.2a2.376 2.376 0 1 0 0 4.75h.2A2.377 2.377 0 0 0 14.476 7.5Zm2.25 0a4.6 4.6 0 0 1-1.494 3.396 5.625 5.625 0 1 1-6.464 0A4.6 4.6 0 0 1 7.274 7.5 4.626 4.626 0 0 1 11.9 2.875h.2A4.626 4.626 0 0 1 16.726 7.5Z"
      />
    </svg>
  );
}
