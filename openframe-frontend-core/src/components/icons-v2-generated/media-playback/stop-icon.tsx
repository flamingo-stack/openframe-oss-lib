import type { SVGProps } from "react";
export interface StopIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StopIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: StopIconProps) {
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
        d="M18.875 7c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 10A4.126 4.126 0 0 1 17 21.125H7A4.125 4.125 0 0 1 2.875 17V7A4.125 4.125 0 0 1 7 2.875h10A4.125 4.125 0 0 1 21.125 7z"
      />
    </svg>
  );
}
