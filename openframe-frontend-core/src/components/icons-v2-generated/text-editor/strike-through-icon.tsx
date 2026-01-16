import type { SVGProps } from "react";
export interface StrikeThroughIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StrikeThroughIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: StrikeThroughIconProps) {
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
        d="M16.875 8a2.876 2.876 0 0 0-2.876-2.875h-3.998a2.876 2.876 0 0 0 0 5.75h3.998a5.126 5.126 0 0 1 0 10.25h-3.998A5.126 5.126 0 0 1 4.875 16a1.125 1.125 0 0 1 2.25 0 2.876 2.876 0 0 0 2.876 2.875h3.998a2.876 2.876 0 0 0 0-5.75h-3.998a5.125 5.125 0 1 1 0-10.25h3.998A5.126 5.126 0 0 1 19.125 8a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M21 10.875a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
