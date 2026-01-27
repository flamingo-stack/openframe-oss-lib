import type { SVGProps } from "react";
export interface BoneIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BoneIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BoneIconProps) {
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
        d="M.875 16A3.625 3.625 0 0 1 4.5 12.375h1.534l6.342-6.342V4.5a3.62 3.62 0 0 1 7.242-.12A3.62 3.62 0 0 1 23.124 8a3.625 3.625 0 0 1-3.623 3.626h-1.536l-6.34 6.34V19.5A3.625 3.625 0 0 1 8 23.125a3.62 3.62 0 0 1-3.62-3.507A3.62 3.62 0 0 1 .875 16m13.75-9.5c0 .298-.118.584-.33.795l-7 7c-.21.212-.497.33-.795.33h-2a1.375 1.375 0 1 0 0 2.75h1A1.126 1.126 0 0 1 6.625 18.5v1a1.375 1.375 0 0 0 2.75 0v-2c0-.299.12-.585.33-.796l7-6.999.17-.14c.184-.123.4-.19.625-.19h2a1.375 1.375 0 0 0 0-2.75h-1A1.125 1.125 0 0 1 17.375 5.5v-1a1.376 1.376 0 0 0-2.75 0z"
      />
    </svg>
  );
}
