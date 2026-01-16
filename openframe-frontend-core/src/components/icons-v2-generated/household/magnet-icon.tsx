import type { SVGProps } from "react";
export interface MagnetIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MagnetIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MagnetIconProps) {
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
        d="m7 15.875.115.006a1.125 1.125 0 0 1 0 2.238L7 18.125H2a1.125 1.125 0 0 1 0-2.25zm15 0 .115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-5a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0v8c0 .483.391.874.875.875h1A.874.874 0 0 0 5.875 20v-8a6.126 6.126 0 1 1 12.25 0v8c0 .483.392.874.875.875h1a.874.874 0 0 0 .875-.875zm2.25 8A3.124 3.124 0 0 1 20 23.125h-1A3.125 3.125 0 0 1 15.875 20v-8a3.876 3.876 0 1 0-7.75 0v8A3.124 3.124 0 0 1 5 23.125H4A3.125 3.125 0 0 1 .875 20v-8C.875 5.857 5.856.876 12.001.876c6.143 0 11.124 4.981 11.124 11.126z"
      />
    </svg>
  );
}
