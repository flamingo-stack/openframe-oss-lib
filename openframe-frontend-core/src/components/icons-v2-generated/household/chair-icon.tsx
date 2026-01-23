import type { SVGProps } from "react";
export interface ChairIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChairIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChairIconProps) {
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
        d="M13.875 13.5v-2.376h-3.75v2.377a1.125 1.125 0 0 1-2.25 0v-2.42A3.12 3.12 0 0 1 5.26 8.195l-.25-4A3.125 3.125 0 0 1 8.128.874h7.744c1.802 0 3.23 1.52 3.118 3.32l-.25 4a3.12 3.12 0 0 1-2.615 2.886v2.42a1.125 1.125 0 0 1-2.25 0M8.128 3.126a.876.876 0 0 0-.873.93l.25 4c.03.46.412.82.874.82h7.242c.462 0 .844-.36.873-.82l.25-4a.876.876 0 0 0-.872-.93z"
      />
      <path
        fill={color}
        d="M17.375 15.5a.876.876 0 0 0-.875-.875h-9a.875.875 0 0 0-.875.874v.876h10.75zm2.25 1.5c0 .897-.728 1.625-1.625 1.625h-.743l.362 3.251.006.114a1.125 1.125 0 0 1-2.224.248l-.02-.114-.387-3.498H9.007l-.388 3.497-.02.115a1.125 1.125 0 0 1-2.217-.362l.36-3.25H6a1.626 1.626 0 0 1-1.625-1.627v-1.5A3.125 3.125 0 0 1 7.5 12.375h9a3.126 3.126 0 0 1 3.125 3.124z"
      />
    </svg>
  );
}
