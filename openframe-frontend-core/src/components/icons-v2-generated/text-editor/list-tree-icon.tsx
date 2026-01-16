import type { SVGProps } from "react";
export interface ListTreeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ListTreeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ListTreeIconProps) {
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
        d="M21 16.875a1.125 1.125 0 0 1 0 2.25h-7a1.125 1.125 0 0 1 0-2.25zm0-6a1.125 1.125 0 0 1 0 2.25h-7a1.125 1.125 0 0 1 0-2.25zm0-6a1.125 1.125 0 0 1 0 2.25H9a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M10 15.875c.622 0 1.126.504 1.126 1.125v2c0 .62-.504 1.124-1.125 1.125H8a1.125 1.125 0 0 1-1.118-1H6A3.125 3.125 0 0 1 2.875 16V8.117c-.562-.062-1-.538-1-1.117V5l.006-.116A1.125 1.125 0 0 1 3 3.875h2c.62 0 1.125.504 1.125 1.125v2c0 .578-.437 1.053-1 1.116v2.76h1.757c.062-.563.538-1 1.118-1.001h2c.622 0 1.126.504 1.126 1.125v2c0 .62-.504 1.124-1.125 1.124H8a1.125 1.125 0 0 1-1.118-.998H5.125v2.873c0 .484.392.876.875.876h.882c.062-.562.538-1 1.118-1z"
      />
    </svg>
  );
}
