import type { SVGProps } from "react";
export interface ZoomOutIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ZoomOutIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ZoomOutIconProps) {
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
        d="M6.548 15.862a1.125 1.125 0 1 1 1.59 1.59l-4.343 4.344a1.126 1.126 0 0 1-1.59-1.59zM16 9.875l.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-6a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M19.875 11a6.876 6.876 0 1 0-13.751.002A6.876 6.876 0 0 0 19.876 11Zm2.25 0a9.126 9.126 0 1 1-18.25 0 9.126 9.126 0 0 1 18.25 0"
      />
    </svg>
  );
}
